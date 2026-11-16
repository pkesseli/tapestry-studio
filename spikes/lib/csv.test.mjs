import { expect, test } from 'vitest';
import { parseCsv, toCsv } from './csv.mjs';

test('reads plain rows, skipping blank lines and Windows line ends', () => {
  expect(parseCsv('file,score,notes\r\na.mp4,,\r\n\r\nb.mp4,4,good\r\n')).toEqual([
    ['file', 'score', 'notes'],
    ['a.mp4', '', ''],
    ['b.mp4', '4', 'good'],
  ]);
});

test('quoted cells can hold commas, quotes and line breaks', () => {
  const text = 'a.mp4,3,"soft, a bit ""muddy""\nsecond line"\n';
  expect(parseCsv(text)).toEqual([['a.mp4', '3', 'soft, a bit "muddy"\nsecond line']]);
});

test('writing and reading back gives the same rows, quoting only when needed', () => {
  const rows = [
    ['file', 'score_1_to_5', 'notes'],
    ['a.mp4', '5', 'plain'],
    ['b.wav', '2', 'needs, "care"\nreally'],
    ['c.wav', '', ''],
  ];
  const csv = toCsv(rows);
  expect(csv).toContain('a.mp4,5,plain\n');
  expect(csv).toContain('"needs, ""care""\nreally"');
  expect(parseCsv(csv)).toEqual(rows);
});
