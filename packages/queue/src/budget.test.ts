import type { Budget, Job } from '@tapestry/core';
import { MOCK_MANIFEST } from '@tapestry/providers';
import type { ProviderManifest } from '@tapestry/providers';
import { expect, test } from 'vitest';
import { checkApproval, computeSpend } from './budget';
import { request } from './test-harness';

/** Budget with a 10 USD project cap and a 4 USD per-approval cap. */
const budget: Budget = { currency: 'USD', projectCap: 10, perApprovalCap: 4 };

/** A provider that can cost money. */
const paid: ProviderManifest = { ...MOCK_MANIFEST, name: 'Paid', paid: true };

/**
 * Builds a minimal job.
 * @param state Job state.
 * @param fields Extra fields such as `estimate` or `actualCost`.
 */
function job(state: Job['state'], fields: Partial<Job> = {}): Job {
  return {
    id: 'job_00000000000000000000000001',
    state,
    request: request(),
    artifactIds: [],
    history: [],
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    ...fields,
  };
}

test('counts finished jobs as spent and waiting jobs as reserved', () => {
  const jobs = [
    job('accepted', { actualCost: 3 }),
    job('queued', { budgetCap: 2 }),
    job('running', { estimate: { cost: 1, notes: '' } }),
    job('draft', { estimate: { cost: 9, notes: '' } }),
  ];
  expect(computeSpend(jobs, budget)).toEqual({ spent: 3, reserved: 3, remaining: 4 });
});

test('cancelling a job releases its reservation', () => {
  const queued = job('queued', { budgetCap: 2 });
  expect(computeSpend([queued], budget).remaining).toBe(8);
  expect(computeSpend([{ ...queued, state: 'cancelled' }], budget).remaining).toBe(10);
});

test('free providers never need a budget', () => {
  expect(
    checkApproval(job('draft'), MOCK_MANIFEST, undefined, computeSpend([], undefined)),
  ).toBeUndefined();
});

test('paid providers need a budget and an estimate', () => {
  const draft = job('draft', { estimate: { cost: 1, notes: '' } });
  expect(checkApproval(draft, paid, undefined, computeSpend([], undefined))).toMatch(
    /set a budget/,
  );
  expect(checkApproval(job('draft'), paid, budget, computeSpend([], budget))).toMatch(
    /no cost estimate/,
  );
});

test('rejects approvals above the per-approval cap or the remaining budget', () => {
  const big = job('draft', { estimate: { cost: 5, notes: '' } });
  expect(checkApproval(big, paid, budget, computeSpend([], budget))).toMatch(
    /per-approval limit of 4/,
  );
  const medium = job('draft', { estimate: { cost: 3, notes: '' } });
  const spent = computeSpend([job('accepted', { actualCost: 8 })], budget);
  expect(checkApproval(medium, paid, budget, spent)).toMatch(/2 left/);
  expect(checkApproval(medium, paid, budget, computeSpend([], budget))).toBeUndefined();
});
