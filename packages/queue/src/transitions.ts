import type { JobState } from '@tapestry/core';

/**
 * Legal job state changes (see the diagram in doc/readme/architecture.md). Everything not listed is illegal.
 * `redone` and `cancelled` are final. `accepted` can only be left by an explicit un-accept (back to `rendered`) or by
 * the system marking it `enhanced` once an enhanced version exists.
 */
export const TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  draft: ['approved', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['running', 'failed', 'cancelled'],
  running: ['rendered', 'queued', 'failed', 'cancelled'],
  rendered: ['accepted', 'redone'],
  accepted: ['rendered', 'enhanced'],
  enhanced: ['accepted'],
  redone: [],
  failed: ['queued', 'cancelled'],
  cancelled: [],
};

/** Raised for operations the queue refuses: illegal transitions, budget violations, unknown jobs. */
export class QueueError extends Error {
  /** @param message Plain-language reason, safe to show to the user. */
  constructor(message: string) {
    super(message);
    this.name = 'QueueError';
  }
}

/**
 * Tells whether a state change is allowed.
 * @param from Current state.
 * @param to Wanted state.
 */
export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Throws unless a state change is allowed.
 * @param from Current state.
 * @param to Wanted state.
 * @throws {QueueError} When the change is illegal.
 */
export function assertTransition(from: JobState, to: JobState): void {
  if (!canTransition(from, to)) throw new QueueError(`A ${from} job cannot become ${to}`);
}

/** States in which a job occupies a provider slot or is waiting for one: its estimated cost is reserved. */
export const RESERVING_STATES: readonly JobState[] = ['approved', 'queued', 'running'];

/** States in which a job's cost has been (or may have been) incurred. */
export const SPENT_STATES: readonly JobState[] = [
  'rendered',
  'accepted',
  'enhanced',
  'redone',
  'failed',
  'cancelled',
];
