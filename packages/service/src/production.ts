import type { Artifact, GenerationRequest, Id, Job } from '@tapestry/core';
import { JobQueue } from '@tapestry/queue';
import type { QueueOptions } from '@tapestry/queue';
import type { ProviderManifest } from '@tapestry/providers';

/** What a new job is for. */
export interface StartOptions {
  /** The shot the result belongs to. */
  targetId: string;
  /** On a final: the accepted draft job it follows. */
  sourceJobId?: Id<'job'>;
}

/**
 * The open project's generation work: a queue plus a background runner. Jobs for providers that are free to use start
 * as soon as they are created; a job for a paid provider waits in `draft` for an explicit approval with a budget
 * (plan 09). The queue is the only writer of job and artifact files while the app runs.
 */
export class Production {
  /** The runner currently ticking the queue, if any. */
  private running: Promise<void> | undefined;

  /** Use {@link Production.open}. */
  private constructor(readonly queue: JobQueue) {}

  /**
   * Opens the queue of a project and resumes interrupted work.
   * @param options Queue configuration (file system, providers, budget).
   * @param onChange Called after every change to a job; the service uses it to refresh what the interface shows.
   */
  static async open(options: QueueOptions, onChange: () => void): Promise<Production> {
    const production = new Production(await JobQueue.open(options));
    production.queue.subscribe((event) => event.type === 'job-changed' && onChange());
    production.kick();
    return production;
  }

  /** All jobs, oldest first. */
  jobs(): Job[] {
    return this.queue.list();
  }

  /**
   * Reads the stored result records of jobs.
   * @param jobs The jobs whose artifacts are wanted.
   */
  async artifactsOf(jobs: readonly Job[]): Promise<Artifact[]> {
    const found = await Promise.all(
      jobs.flatMap((job) => job.artifactIds).map((id) => this.queue.artifacts.load(id)),
    );
    return found.flatMap((artifact) => artifact ?? []);
  }

  /**
   * Creates a job for a request. A job for a free provider is approved at once and starts; one for a paid provider stays
   * a draft until it is approved.
   * @param request What to make.
   * @param manifest The provider that will run it.
   * @param options The shot it is for, and the draft it follows if it is a final.
   */
  async start(
    request: GenerationRequest,
    manifest: ProviderManifest,
    options: StartOptions,
  ): Promise<Job> {
    const job = await this.queue.createDraft(request, {
      targetId: options.targetId,
      ...(options.sourceJobId !== undefined && { sourceJobId: options.sourceJobId }),
    });
    if (manifest.paid) return job;
    return this.approve(job.id);
  }

  /**
   * Approves a job and starts working through the queue.
   * @param id Job id.
   */
  async approve(id: Id<'job'>): Promise<Job> {
    const approved = await this.queue.approve(id);
    this.kick();
    return approved;
  }

  /**
   * Accepts a rendered take: it is frozen and becomes part of the film.
   * @param id Job id.
   */
  accept(id: Id<'job'>): Promise<Job> {
    return this.queue.accept(id);
  }

  /**
   * Rejects a take and starts another attempt at the same shot with a fresh seed.
   * @param id Job id.
   * @param manifest The provider, to decide whether the new job starts at once.
   */
  async another(id: Id<'job'>, manifest: ProviderManifest): Promise<Job> {
    const next = await this.queue.redo(id);
    return manifest.paid ? next : this.approve(next.id);
  }

  /** Resolves when no work is queued or running. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  /** Starts the runner unless it is already running; it stops itself when the queue is empty. */
  private kick(): void {
    if (this.running) return;
    this.running = (async () => {
      do {
        await this.queue.runUntilIdle();
      } while (!this.queue.isIdle());
    })()
      .catch(() => undefined)
      .finally(() => {
        this.running = undefined;
        // A job approved just as the runner finished must not wait for the next one.
        if (!this.queue.isIdle()) this.kick();
      });
  }
}
