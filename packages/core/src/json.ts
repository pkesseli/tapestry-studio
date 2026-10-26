/**
 * Serialises a value as JSON with recursively sorted object keys, two-space indentation and a trailing newline, so
 * that identical data always produces identical bytes and git diffs stay minimal.
 * @param value Any JSON-compatible value; `undefined` properties are omitted like `JSON.stringify` does.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

/**
 * Returns a copy of a value whose object keys are sorted alphabetically at every depth.
 * @param value Value to copy.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortKeys(item)]));
  }
  return value;
}
