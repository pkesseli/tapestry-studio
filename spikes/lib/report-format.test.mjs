import { expect, test } from 'vitest';
import { formatDuration, renderReport } from './report-format.mjs';

const GIB = 1024 ** 3;
const system = {
  chip: 'Apple M4 Pro',
  gpuCores: 20,
  memoryGiB: 48,
  macOS: '15.1',
  capturedAt: '2026-11-12T10:00:00Z',
};
const candidates = [
  { id: 'v1', name: 'Video one', kind: 'video' },
  { id: 'v2', name: 'Video two', kind: 'video' },
  { id: 'i1', name: 'Image one', kind: 'image' },
];

test('durations are short for seconds and in minutes after two minutes', () => {
  expect(formatDuration(95)).toBe('95 s');
  expect(formatDuration(900)).toBe('15 min');
  expect(formatDuration(null)).toBe('-');
});

test('the report lists every candidate, derives the verdict from runs, and counts the acceptance', () => {
  const runs = [
    { candidate: 'v1', outcome: 'ok', seconds: 120, peakBytes: 30 * GIB },
    { candidate: 'v2', outcome: 'timeout', seconds: 2700, peakBytes: null },
  ];
  const findings = { v2: { blockers: 'Too slow.' }, summary: 'Use v1.' };
  const text = renderReport({ system, candidates, runs, findings });
  expect(text).toContain('Apple M4 Pro, 20 GPU cores, 48 GB memory, macOS 15.1');
  expect(text).toMatch(/\| Video one \| video \| yes \| 1 \/ 1 \| 2 min \| 30.0 GB \|/);
  expect(text).toMatch(/\| Video two \| video \| no \| 0 \/ 1 .* 1 timed out; Too slow\. \|/);
  expect(text).toMatch(/\| Image one \| image \| not tried \| 0 \/ 0 \|/);
  expect(text).toContain('- video: 1 of 3 needed ran (NOT met)');
  expect(text).toContain('## Recommended local defaults\n\nUse v1.');
});

test('a human verdict overrides the runs, and a missing machine is called out', () => {
  const findings = { v1: { runs: 'partly' } };
  const text = renderReport({ system: null, candidates, runs: [], findings });
  expect(text).toContain('Machine not recorded');
  expect(text).toMatch(/\| Video one \| video \| partly \|/);
});
