import { expect, test } from 'vitest';
import { stableStringify } from './json';

test('sorts keys recursively and ends with a newline', () => {
  const text = stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } });
  expect(text).toBe(
    '{\n  "a": {\n    "c": null,\n    "d": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
  );
});

test('is independent of key insertion order', () => {
  expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
});

test('omits undefined properties', () => {
  expect(stableStringify({ a: undefined, b: 1 })).toBe('{\n  "b": 1\n}\n');
});
