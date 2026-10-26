/**
 * Splits text into lower-case word tokens.
 * @param key A normalised key such as a scene heading.
 */
function tokens(key: string): Set<string> {
  return new Set(key.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

/**
 * Similarity of two keys: shared words divided by all words (0 to 1).
 * @param a First key.
 * @param b Second key.
 */
export function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/**
 * Matches the items of a new version of a list to the items of the old version, so that ids and user edits survive
 * re-parsing. Order is respected where keys are equal (longest common subsequence); what is left over is matched by
 * identical key anywhere (items that moved), then by word similarity (items that were renamed a little).
 * @param oldKeys Normalised keys of the old items.
 * @param newKeys Normalised keys of the new items.
 * @param minSimilarity Smallest word similarity that still counts as "the same item, renamed".
 * @returns For each new item, the index of its old counterpart, or `undefined` when it is new.
 */
export function alignKeys(
  oldKeys: readonly string[],
  newKeys: readonly string[],
  minSimilarity = 0.5,
): (number | undefined)[] {
  const n = oldKeys.length;
  const m = newKeys.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        oldKeys[i] === newKeys[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const result: (number | undefined)[] = new Array<number | undefined>(m).fill(undefined);
  const used = new Set<number>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (oldKeys[i] === newKeys[j]) {
      result[j] = i;
      used.add(i);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }
  for (let j = 0; j < m; j++) {
    if (result[j] !== undefined) continue;
    const i = oldKeys.findIndex((key, index) => !used.has(index) && key === newKeys[j]);
    if (i >= 0) {
      result[j] = i;
      used.add(i);
    }
  }
  const candidates: { i: number; j: number; score: number }[] = [];
  for (let j = 0; j < m; j++) {
    if (result[j] !== undefined) continue;
    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      const score = similarity(oldKeys[i] ?? '', newKeys[j] ?? '');
      if (score >= minSimilarity) candidates.push({ i, j, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.j - b.j || a.i - b.i);
  for (const { i, j } of candidates) {
    if (result[j] === undefined && !used.has(i)) {
      result[j] = i;
      used.add(i);
    }
  }
  return result;
}
