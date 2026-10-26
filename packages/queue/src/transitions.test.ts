import { JobStateSchema } from '@tapestry/core';
import type { JobState } from '@tapestry/core';
import { expect, test } from 'vitest';
import { QueueError, TRANSITIONS, assertTransition, canTransition } from './transitions';

/** Every state, taken from the schema so a new state cannot be forgotten here. */
const STATES: JobState[] = JobStateSchema.options;

test('the table covers every state and only mentions real states', () => {
  expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATES].sort());
  for (const targets of Object.values(TRANSITIONS)) {
    for (const target of targets) expect(STATES).toContain(target);
  }
});

test('every pair of states is either allowed by the table or rejected with a clear error', () => {
  for (const from of STATES) {
    for (const to of STATES) {
      if (canTransition(from, to)) {
        expect(() => assertTransition(from, to)).not.toThrow();
      } else {
        expect(() => assertTransition(from, to)).toThrow(QueueError);
        expect(() => assertTransition(from, to)).toThrow(`A ${from} job cannot become ${to}`);
      }
    }
  }
});

test('cancelled and redone are final', () => {
  expect(TRANSITIONS.cancelled).toEqual([]);
  expect(TRANSITIONS.redone).toEqual([]);
});

test('every state can be reached from draft', () => {
  const seen = new Set<JobState>(['draft']);
  const todo: JobState[] = ['draft'];
  while (todo.length > 0) {
    for (const next of TRANSITIONS[todo.pop() as JobState]) {
      if (!seen.has(next)) {
        seen.add(next);
        todo.push(next);
      }
    }
  }
  expect([...seen].sort()).toEqual([...STATES].sort());
});

test('a rendered result must be accepted before it can be enhanced', () => {
  expect(canTransition('rendered', 'enhanced')).toBe(false);
  expect(canTransition('accepted', 'enhanced')).toBe(true);
});
