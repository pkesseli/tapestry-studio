import { expect, test } from 'vitest';
import { groupByShot, progress, questionsFor, seededShuffle, setAnswer } from './logic.mjs';

/** Two shots: S02 has a draft and two finals, S01 a draft only. */
const manifest = {
  clips: [
    { id: 'D-S02', shot: 'S02', role: 'draft' },
    { id: 'F-S02-1', shot: 'S02', role: 'final' },
    { id: 'F-S02-2', shot: 'S02', role: 'final' },
    { id: 'D-S01', shot: 'S01', role: 'draft' },
  ],
};

test('the shuffle is repeatable for the same seed, differs between seeds, and keeps every item', () => {
  const items = Array.from({ length: 12 }, (_, i) => i);
  expect(seededShuffle(items, 'a')).toEqual(seededShuffle(items, 'a'));
  expect(seededShuffle(items, 'a')).not.toEqual(seededShuffle(items, 'b'));
  expect([...seededShuffle(items, 'a')].sort((x, y) => x - y)).toEqual(items);
  expect(items[0]).toBe(0);
});

test('shots follow the given order, with drafts and finals separated', () => {
  const groups = groupByShot(manifest, ['S01', 'S02'], 'maria');
  expect(groups.map((g) => g.shot)).toEqual(['S01', 'S02']);
  expect(groups[1].drafts.map((c) => c.id)).toEqual(['D-S02']);
  expect(groups[1].finals.map((c) => c.id).sort()).toEqual(['F-S02-1', 'F-S02-2']);
});

test('answers are recorded without changing the earlier ratings object', () => {
  const first = {};
  const second = setAnswer(first, 'F-S02-1', 'composition', 4);
  const third = setAnswer(second, 'F-S02-1', 'usable', 'yes');
  expect(first).toEqual({});
  expect(third.clips['F-S02-1']).toEqual({ composition: 4, usable: 'yes' });
});

test('a clip counts as done only when every question is answered', () => {
  let ratings = {};
  const clips = manifest.clips.filter((c) => c.shot === 'S02');
  expect(progress(ratings, clips)).toEqual({ done: 0, total: 3 });
  for (const q of questionsFor({ role: 'draft' })) ratings = setAnswer(ratings, 'D-S02', q.key, 5);
  expect(progress(ratings, clips).done).toBe(1);
  for (const q of questionsFor({ role: 'final' }))
    ratings = setAnswer(ratings, 'F-S02-1', q.key, 3);
  expect(progress(ratings, clips).done).toBe(1);
  ratings = setAnswer(ratings, 'F-S02-1', 'usable', 'maybe');
  expect(progress(ratings, clips).done).toBe(2);
});
