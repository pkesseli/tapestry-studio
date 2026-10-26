import { newId } from '@tapestry/core';
import type { Budget, FsPort, GenerationRequest, Id, Job } from '@tapestry/core';
import { ProviderError } from '@tapestry/providers';
import type { PollResult, Provider, ProviderConfig, ProviderRegistry } from '@tapestry/providers';
import { ArtifactStore } from './artifact-store';
import { checkApproval, computeSpend } from './budget';
import type { Spend } from './budget';
import { hashJson } from './hash';
import { JobStore } from './job-store';
import type { QueueEvent } from './job-store';
import { QueueError, assertTransition } from './transitions';

export type { QueueEvent } from './job-store';

/** Everything a queue needs from its surroundings. */
export interface QueueOptions {
  /** File system rooted at the project folder; jobs and artifacts are stored there. */
  fs: FsPort;
  registry: ProviderRegistry;
  /** Provider configuration (API keys already resolved by the app). */
  configFor?(providerId: string): ProviderConfig;
  /** The project's spending limits; without one, providers that can cost money are refused. */
  budget?: Budget | undefined;
  /** Parallel jobs per provider id. Default: 1 for local providers, 4 otherwise. */
  concurrency?: Record<string, number>;
  /** Attempts (including the first) before a retryable failure becomes final. Default 4. */
  maxAttempts?: number;
  /** Seconds before the first retry; doubles each time. Default 2. */
  backoffBaseSeconds?: number;
  /** Pause between scheduler steps in `runUntilIdle`. Default 500 ms. */
  pollIntervalMs?: number;
  /** Clock; tests inject a fake one. */
  now?(): Date;
  /** Random numbers in [0, 1); tests inject a seeded one. */
  random?(): number;
  /** Waits; tests inject one that advances the fake clock. */
  sleep?(ms: number): Promise<void>;
}

/** Extra information when creating a draft. */
export interface DraftOptions {
  /** Shot or section the result is for. */
  targetId?: string;
  /** Higher runs first. */
  priority?: number;
}

/** Persistent, restart-safe generation queue. See doc/readme/architecture.md for the lifecycle. */
export class JobQueue {
  /** Persistence and events for jobs. */
  private readonly store: JobStore;
  /** Provider instances by provider id. */
  private readonly providers = new Map<string, Provider>();
  /** Artifact storage with the freeze rule. */
  readonly artifacts: ArtifactStore;

  /** Use {@link JobQueue.open}. */
  private constructor(private readonly options: QueueOptions) {
    this.store = new JobStore(options.fs, options.now ?? (() => new Date()));
    this.artifacts = new ArtifactStore(options.fs);
  }

  /**
   * Opens the queue of a project, loading its jobs and recovering from an interrupted run: jobs that were running but
   * never recorded a provider reference are queued again (submit is idempotent, so this cannot duplicate work).
   * @param options Queue configuration.
   */
  static async open(options: QueueOptions): Promise<JobQueue> {
    const queue = new JobQueue(options);
    await queue.store.load();
    for (const job of queue.list().filter((j) => j.state === 'running' && !j.remoteRef)) {
      await queue.store.move(job, 'queued', 'system', 'Recovered after restart');
    }
    return queue;
  }

  /** All jobs, oldest first. */
  list(): Job[] {
    return this.store.list();
  }

  /**
   * Looks up a job.
   * @param id Job id.
   */
  get(id: Id<'job'>): Job | undefined {
    return this.store.get(id);
  }

  /** Current money position under the project budget. */
  spend(): Spend {
    return computeSpend(this.list(), this.options.budget);
  }

  /**
   * Subscribes to queue events.
   * @param listener Called synchronously for every event.
   * @returns A function that unsubscribes.
   */
  subscribe(listener: (event: QueueEvent) => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Creates a job in the Draft state with a cost and time estimate. Nothing runs and nothing is spent until approval.
   * @param request What to generate.
   * @param draft Optional target and priority.
   * @throws {QueueError} When the provider is unknown or the request exceeds its limits.
   */
  async createDraft(request: GenerationRequest, draft: DraftOptions = {}): Promise<Job> {
    const estimate = this.provider(request.provider.providerId).estimate(request);
    if (!estimate.ok) throw new QueueError(estimate.reason);
    const at = this.store.timestamp();
    return this.store.persist({
      id: newId('job'),
      state: 'draft',
      request,
      estimate: estimate.estimate,
      artifactIds: [],
      history: [{ at, to: 'draft', actor: 'user' }],
      createdAt: at,
      updatedAt: at,
      ...(draft.targetId !== undefined && { targetId: draft.targetId }),
      ...(draft.priority !== undefined && { priority: draft.priority }),
    });
  }

  /**
   * Authorises a job to run: checks the budget, reserves its estimated cost and puts it in the queue.
   * @param id Job id.
   * @throws {QueueError} When the job is not a draft or the budget forbids it.
   */
  async approve(id: Id<'job'>): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'approved');
    const manifest = this.provider(job.request.provider.providerId).manifest;
    const reason = checkApproval(job, manifest, this.options.budget, this.spend());
    if (reason) throw new QueueError(reason);
    const cap = manifest.paid ? (job.estimate?.cost ?? 0) : undefined;
    const approved = await this.store.move(
      job,
      'approved',
      'user',
      undefined,
      cap !== undefined ? { budgetCap: cap } : {},
    );
    return this.store.move(approved, 'queued', 'system', 'Waiting for a free slot');
  }

  /**
   * Cancels a job that has not finished. A running job is also cancelled at the provider.
   * @param id Job id.
   */
  async cancel(id: Id<'job'>): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'cancelled');
    if (job.state === 'running' && job.remoteRef) {
      await this.provider(job.request.provider.providerId).cancel(job.remoteRef);
    }
    return this.store.move(job, 'cancelled', 'user');
  }

  /**
   * Accepts a rendered result: the artifact is frozen and becomes part of the film.
   * @param id Job id.
   * @param artifactId Which result to accept; defaults to the first.
   */
  async accept(id: Id<'job'>, artifactId?: Id<'art'>): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'accepted');
    const chosen = artifactId ?? job.artifactIds[0];
    if (!chosen || !job.artifactIds.includes(chosen)) {
      throw new QueueError('That result does not belong to this job');
    }
    await this.artifacts.freeze(chosen, this.store.timestamp());
    return this.store.move(job, 'accepted', 'user');
  }

  /**
   * Lifts the freeze on an accepted result after an explicit user decision. The files are kept.
   * @param id Job id.
   */
  async unaccept(id: Id<'job'>): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'rendered');
    for (const artifactId of job.artifactIds) {
      if ((await this.artifacts.load(artifactId))?.accepted)
        await this.artifacts.unfreeze(artifactId);
    }
    return this.store.move(job, 'rendered', 'user', 'Un-accepted by the user');
  }

  /**
   * Rejects a rendered result and creates a new draft to try again. The rejected files stay on disk.
   * @param id Job id of the rendered job.
   * @param changes Edits to the request for the new attempt; a fresh random seed is used unless one is given.
   */
  async redo(id: Id<'job'>, changes: Partial<GenerationRequest> = {}): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'redone');
    const seed = changes.seed ?? Math.floor((this.options.random?.() ?? Math.random()) * 2 ** 31);
    const next = await this.createDraft(
      { ...job.request, ...changes, seed },
      {
        ...(job.targetId !== undefined && { targetId: job.targetId }),
        ...(job.priority !== undefined && { priority: job.priority }),
      },
    );
    await this.store.move(job, 'redone', 'user', `Replaced by ${next.id}`);
    return next;
  }

  /**
   * Puts a failed job back in the queue.
   * @param id Job id.
   */
  async retry(id: Id<'job'>): Promise<Job> {
    const job = this.store.require(id);
    assertTransition(job.state, 'queued');
    return this.store.move(job, 'queued', 'user', 'Retried by the user', { attempts: 0 });
  }

  /** Runs one scheduler step: polls running jobs, then starts queued jobs that fit free slots. */
  async tick(): Promise<void> {
    for (const job of this.list().filter((j) => j.state === 'running' && j.remoteRef)) {
      await this.pollJob(job);
    }
    await this.startQueued();
    if (this.isIdle()) this.store.emit({ type: 'idle' });
  }

  /**
   * Keeps ticking until no job is queued or running (drafts, finished, failed and cancelled jobs do not count).
   * @param maxTicks Safety bound.
   */
  async runUntilIdle(maxTicks = 100_000): Promise<void> {
    const sleep =
      this.options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
    for (let i = 0; i < maxTicks && !this.isIdle(); i++) {
      await this.tick();
      if (!this.isIdle()) await sleep(this.options.pollIntervalMs ?? 500);
    }
  }

  /** True when no job is waiting for or occupying a provider. */
  isIdle(): boolean {
    return !this.list().some((job) => job.state === 'queued' || job.state === 'running');
  }

  /** Starts queued jobs, highest priority first, within each provider's concurrency limit. */
  private async startQueued(): Promise<void> {
    const now = this.store.now().getTime();
    const waiting = this.list()
      .filter((job) => job.state === 'queued' && (!job.retryAt || Date.parse(job.retryAt) <= now))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : 1));
    for (const job of waiting) {
      const providerId = job.request.provider.providerId;
      const running = this.list().filter(
        (j) => j.state === 'running' && j.request.provider.providerId === providerId,
      );
      if (running.length >= this.limitFor(providerId)) continue;
      try {
        const ref = await this.provider(providerId).submit(job.request, {
          idempotencyKey: job.id,
          readFile: (path) => this.options.fs.readBytes(path),
        });
        await this.store.move(job, 'running', 'system', undefined, { remoteRef: ref });
      } catch (error) {
        await this.handleFailure(job, error);
      }
    }
  }

  /**
   * Asks the provider about one running job and applies the answer.
   * @param job A running job with a provider reference.
   */
  private async pollJob(job: Job): Promise<void> {
    let result: PollResult;
    try {
      result = await this.provider(job.request.provider.providerId).poll(job.remoteRef ?? '');
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) return;
      await this.handleFailure(job, error);
      return;
    }
    if (result.status === 'pending' || result.status === 'running') {
      if (result.progress !== undefined) {
        this.store.emit({ type: 'progress', jobId: job.id, progress: result.progress });
      }
    } else if (result.status === 'cancelled') {
      await this.store.move(job, 'cancelled', 'provider');
    } else if (result.status === 'failed') {
      await this.handleFailure(
        job,
        new ProviderError(result.error.message, result.error.retryable),
      );
    } else if (result.status === 'succeeded') {
      await this.finishSuccess(job, result);
    }
  }

  /**
   * Stores the outputs of a finished job and marks it rendered.
   * @param job The running job.
   * @param result The successful poll result.
   */
  private async finishSuccess(
    job: Job,
    result: Extract<PollResult, { status: 'succeeded' }>,
  ): Promise<void> {
    const artifact = await this.artifacts.create(
      {
        id: newId('art'),
        jobId: job.id,
        accepted: false,
        provenance: {
          providerId: job.request.provider.providerId,
          model: result.info.model,
          ...(result.info.modelVersion !== undefined && { modelVersion: result.info.modelVersion }),
          ...(result.info.seed !== undefined && { seed: result.info.seed }),
          inputsHash: await hashJson(job.request),
          referencePaths: job.request.references.map((r) => r.path),
        },
        notes: '',
        createdAt: this.store.timestamp(),
      },
      result.outputs,
    );
    await this.store.move(job, 'rendered', 'provider', undefined, {
      artifactIds: [...job.artifactIds, artifact.id],
      actualCost: result.actualCost ?? 0,
    });
  }

  /**
   * Retries a retryable failure with exponential back-off, or fails the job for good.
   * @param job The job that failed while starting or running.
   * @param error What went wrong.
   */
  private async handleFailure(job: Job, error: unknown): Promise<void> {
    const retryable = error instanceof ProviderError && error.retryable;
    const message = error instanceof Error ? error.message : String(error);
    const attempts = (job.attempts ?? 0) + 1;
    if (retryable && attempts < (this.options.maxAttempts ?? 4)) {
      const delayMs = (this.options.backoffBaseSeconds ?? 2) * 2 ** (attempts - 1) * 1000;
      const retryAt = new Date(this.store.now().getTime() + delayMs).toISOString();
      const patch = { attempts, retryAt, error: { message, retryable } };
      if (job.state === 'queued') {
        await this.store.update(job, patch);
      } else {
        const note = `Retrying after: ${message}`;
        await this.store.move(job, 'queued', 'system', note, { ...patch, remoteRef: undefined });
      }
      return;
    }
    const final = { attempts, error: { message, retryable } };
    await this.store.move(job, 'failed', 'provider', message, final);
  }

  /**
   * Returns the (cached) provider instance for an id.
   * @param providerId Provider id.
   * @throws {QueueError} When no such provider is registered.
   */
  private provider(providerId: string): Provider {
    let provider = this.providers.get(providerId);
    if (!provider) {
      if (!this.options.registry.get(providerId)) {
        throw new QueueError(`Unknown provider "${providerId}"`);
      }
      const config = this.options.configFor?.(providerId) ?? {};
      provider = this.options.registry.create(providerId, config);
      this.providers.set(providerId, provider);
    }
    return provider;
  }

  /**
   * Maximum parallel jobs for a provider.
   * @param providerId Provider id.
   */
  private limitFor(providerId: string): number {
    const local = this.provider(providerId).manifest.local;
    return this.options.concurrency?.[providerId] ?? (local ? 1 : 4);
  }
}
