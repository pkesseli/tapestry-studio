import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { appendRun, median, parseTimeOutput, readRuns, redactHome, summarizeRuns } from './runs.mjs';

/** What macOS `/usr/bin/time -l` prints after a command. */
const MAC_TIME = `
Loading model...
       95.42 real       310.10 user        12.00 sys
          21474836480  maximum resident set size
                    0  average shared memory size
`;

test('reads seconds and peak memory from the macOS time report', () => {
  expect(parseTimeOutput(MAC_TIME)).toEqual({
    realSeconds: 95.42,
    peakBytes: 21474836480,
    rssBytes: 21474836480,
  });
});

test('prefers the peak memory footprint, which counts GPU memory, over the resident size', () => {
  const text = `${MAC_TIME}          30000000000  peak memory footprint\n`;
  expect(parseTimeOutput(text)).toEqual({ realSeconds: 95.42, peakBytes: 30000000000, rssBytes: 21474836480 });
});

test('a missing report gives nulls, not a crash', () => {
  expect(parseTimeOutput('nothing here')).toEqual({ realSeconds: null, peakBytes: null, rssBytes: null });
});

test('runs are appended one per line and read back, skipping damaged lines', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'spike-')), 'deep', 'runs.jsonl');
  appendRun(file, { label: 'a', outcome: 'ok' });
  writeFileSync(file, '{"label":"a","outcome":"ok"}\n{broken\n{"label":"b"}\n');
  expect(readRuns(file).map((r) => r.label)).toEqual(['a', 'b']);
  expect(readRuns(join(tmpdir(), 'does-not-exist.jsonl'))).toEqual([]);
});

test('median of odd and even lists', () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 2, 3])).toBe(2.5);
});

test('a candidate summary counts outcomes and reports the largest memory use', () => {
  const GIB = 1024 ** 3;
  const summary = summarizeRuns([
    { outcome: 'ok', seconds: 100, peakBytes: 20 * GIB },
    { outcome: 'ok', seconds: 300, peakBytes: 30 * GIB },
    { outcome: 'timeout', seconds: 2700, peakBytes: null },
    { outcome: 'failed', seconds: 5, peakBytes: null },
  ]);
  expect(summary).toMatchObject({
    runs: 4,
    ok: 2,
    failed: 1,
    timedOut: 1,
    noOutput: 0,
    medianSeconds: 200,
    peakGiB: 30,
  });
  expect(summarizeRuns([]).medianSeconds).toBeNull();
});

test('the home folder is replaced with ~ everywhere, and an empty home changes nothing', () => {
  const text = 'log /Users/me/x.log and /Users/me/y; /Users/meow stays apart from its prefix';
  expect(redactHome(text, '/Users/me')).toBe('log ~/x.log and ~/y; ~ow stays apart from its prefix');
  expect(redactHome(text, '')).toBe(text);
});
