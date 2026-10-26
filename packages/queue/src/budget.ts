import type { Budget, Job } from '@tapestry/core';
import type { ProviderManifest } from '@tapestry/providers';
import { RESERVING_STATES, SPENT_STATES } from './transitions';

/** Money position of a project. */
export interface Spend {
  /** Cost already incurred by finished jobs. */
  spent: number;
  /** Estimated cost of jobs that are approved, waiting or running. */
  reserved: number;
  /** What may still be approved: cap minus spent minus reserved (infinite without a budget). */
  remaining: number;
}

/**
 * Computes how much has been spent and reserved.
 * @param jobs All jobs of the project.
 * @param budget The project's spending limits, if any.
 */
export function computeSpend(jobs: readonly Job[], budget: Budget | undefined): Spend {
  const sum = (selected: Job[], value: (job: Job) => number): number =>
    selected.reduce((total, job) => total + value(job), 0);
  const spent = sum(
    jobs.filter((job) => SPENT_STATES.includes(job.state)),
    (job) => job.actualCost ?? 0,
  );
  const reserved = sum(
    jobs.filter((job) => RESERVING_STATES.includes(job.state)),
    (job) => job.budgetCap ?? job.estimate?.cost ?? 0,
  );
  return { spent, reserved, remaining: budget ? budget.projectCap - spent - reserved : Infinity };
}

/**
 * Decides whether a job may be approved, in plain language.
 * Free jobs are always fine. Jobs that can cost money need a budget, must fit the per-approval cap, and must fit what
 * is left of the project cap. Enforcement lives here, never in provider adapters (doc/readme/testing.md).
 * @param job The job the user wants to approve.
 * @param manifest Manifest of the job's provider.
 * @param budget The project's spending limits, if any.
 * @param spend Current money position.
 * @returns The reason it may not be approved, or `undefined` when it may.
 */
export function checkApproval(
  job: Job,
  manifest: ProviderManifest,
  budget: Budget | undefined,
  spend: Spend,
): string | undefined {
  if (!manifest.paid) return undefined;
  const cost = job.estimate?.cost;
  if (!budget) return `${manifest.name} can cost money; set a budget for this project first`;
  if (cost === undefined) return `${manifest.name} gave no cost estimate, so it cannot be approved`;
  if (cost > budget.perApprovalCap) {
    return `Estimated cost ${cost} ${budget.currency} is above the per-approval limit of ${budget.perApprovalCap}`;
  }
  if (cost > spend.remaining) {
    return `Estimated cost ${cost} ${budget.currency} is more than the ${spend.remaining} left in the project budget`;
  }
  return undefined;
}
