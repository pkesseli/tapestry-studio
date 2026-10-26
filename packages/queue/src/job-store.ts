import { JobSchema, fromZodError, jobFile, stableStringify } from '@tapestry/core';
import type { FsPort, Id, Job, JobState } from '@tapestry/core';
import { QueueError, assertTransition } from './transitions';

/** Who caused a state change, recorded in the job history. */
export type Actor = 'user' | 'system' | 'provider';

/** What subscribers are told about. */
export type QueueEvent =
  | { type: 'job-changed'; job: Job }
  | { type: 'progress'; jobId: Id<'job'>; progress: number }
  | { type: 'idle' };

/** Holds all jobs of a project in memory and persists every change to `jobs/<id>.json`, announcing it to subscribers. */
export class JobStore {
  /** All jobs by id. */
  private readonly jobs = new Map<Id<'job'>, Job>();
  /** Event subscribers. */
  private readonly listeners = new Set<(event: QueueEvent) => void>();

  /**
   * @param fs File system rooted at the project folder.
   * @param clock Source of the current time.
   */
  constructor(
    private readonly fs: FsPort,
    private readonly clock: () => Date,
  ) {}

  /**
   * Reads all job files from disk.
   * @throws {ProjectFormatError} When a job file is invalid.
   */
  async load(): Promise<void> {
    for (const entry of await this.fs.list('jobs')) {
      if (entry.isDirectory || !entry.name.endsWith('.json')) continue;
      const path = `jobs/${entry.name}`;
      const parsed = JobSchema.safeParse(JSON.parse(await this.fs.readText(path)));
      if (!parsed.success) throw fromZodError(path, parsed.error);
      this.jobs.set(parsed.data.id, parsed.data);
    }
  }

  /** All jobs, oldest first (ids sort by creation time). */
  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /**
   * Looks up a job.
   * @param id Job id.
   */
  get(id: Id<'job'>): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Loads a job or throws.
   * @param id Job id.
   * @throws {QueueError} When the job does not exist.
   */
  require(id: Id<'job'>): Job {
    const job = this.jobs.get(id);
    if (!job) throw new QueueError(`Unknown job ${id}`);
    return job;
  }

  /** Current time from the injected clock. */
  now(): Date {
    return this.clock();
  }

  /** Current time as an ISO-8601 string. */
  timestamp(): string {
    return this.clock().toISOString();
  }

  /**
   * Subscribes to events.
   * @param listener Called synchronously for every event.
   * @returns A function that unsubscribes.
   */
  subscribe(listener: (event: QueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies subscribers.
   * @param event What happened.
   */
  emit(event: QueueEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /**
   * Validates, stores and announces a job.
   * @param job The new version of the job.
   */
  async persist(job: Job): Promise<Job> {
    const path = jobFile(job.id);
    const parsed = JobSchema.safeParse(job);
    if (!parsed.success) throw fromZodError(path, parsed.error);
    await this.fs.writeText(path, stableStringify(parsed.data));
    this.jobs.set(job.id, parsed.data);
    this.emit({ type: 'job-changed', job: parsed.data });
    return parsed.data;
  }

  /**
   * Changes fields of a job without a state change.
   * @param job Current job.
   * @param patch Fields to change.
   */
  update(job: Job, patch: Partial<Job>): Promise<Job> {
    return this.persist({ ...job, ...patch, updatedAt: this.timestamp() });
  }

  /**
   * Changes a job's state, recording it in the history and persisting it.
   * @param job Current job.
   * @param to New state.
   * @param actor Who caused the change.
   * @param note Optional explanation for the history.
   * @param patch Other fields to change at the same time.
   * @throws {QueueError} When the change is illegal.
   */
  async move(
    job: Job,
    to: JobState,
    actor: Actor,
    note?: string,
    patch: Partial<Job> = {},
  ): Promise<Job> {
    assertTransition(job.state, to);
    const at = this.timestamp();
    const entry = { at, from: job.state, to, actor, ...(note !== undefined && { note }) };
    return this.persist({
      ...job,
      ...patch,
      state: to,
      updatedAt: at,
      history: [...job.history, entry],
    });
  }
}
