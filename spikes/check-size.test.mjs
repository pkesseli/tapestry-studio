import { expect, test } from 'vitest';
import { MAX_BYTES, findProblems } from './check-size.mjs';

test('small text and preview files pass', () => {
  expect(findProblems([{ file: 'spikes/mac/results/runs.jsonl', bytes: 5_000 }])).toEqual([]);
});

test('model files are refused whatever their size, and big files are refused', () => {
  const problems = findProblems([
    { file: 'spikes/x/model.GGUF', bytes: 10 },
    { file: 'spikes/draft-final/results/out/clip.mp4', bytes: MAX_BYTES + 1 },
  ]);
  expect(problems).toHaveLength(2);
  expect(problems[0]).toContain('model files are never committed');
  expect(problems[1]).toContain('over the 3 MB limit');
});
