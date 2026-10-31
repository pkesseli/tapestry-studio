import { expect, test } from 'vitest';
import { mediaPathOf, parseRange } from './media-protocol';

const ART = 'art_01M69SQX27NF48CBCPBDJK5A8J';

test('serves only files inside artifact folders', () => {
  expect(mediaPathOf(`tapestry-media://project/artifacts/${ART}/clip.mp4`)).toBe(
    `artifacts/${ART}/clip.mp4`,
  );
  expect(mediaPathOf('tapestry-media://project/project.json')).toBeUndefined();
  expect(mediaPathOf('tapestry-media://project/script/main.fountain')).toBeUndefined();
  expect(
    mediaPathOf(`tapestry-media://project/artifacts/${ART}/../../project.json`),
  ).toBeUndefined();
  expect(mediaPathOf(`tapestry-media://project/artifacts/${ART}/%2e%2e/x.mp4`)).toBeUndefined();
  expect(mediaPathOf(`tapestry-media://project/artifacts/${ART}/sub/clip.mp4`)).toBeUndefined();
  expect(mediaPathOf('https://example.com/artifacts/x/clip.mp4')).toBeUndefined();
  expect(mediaPathOf('not a url')).toBeUndefined();
});

test('ignores the time fragment used for still frames', () => {
  expect(mediaPathOf(`tapestry-media://project/artifacts/${ART}/clip.mp4#t=0.1`)).toBe(
    `artifacts/${ART}/clip.mp4`,
  );
});

test('reads byte ranges', () => {
  expect(parseRange(null, 100)).toBeNull();
  expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
  expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
  expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
  expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
});

test('rejects ranges that cannot be satisfied', () => {
  expect(parseRange('bytes=100-', 100)).toBe('invalid');
  expect(parseRange('bytes=20-10', 100)).toBe('invalid');
  expect(parseRange('bytes=-', 100)).toBe('invalid');
  expect(parseRange('items=0-1', 100)).toBe('invalid');
});
