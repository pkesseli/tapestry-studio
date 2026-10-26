import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Maximum number of lines allowed in one source file (rule in AGENTS.md). */
export const MAX_LINES = 400;

/** File extensions that count as source code. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];

/** Directory names never scanned. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'out',
  '.git',
  'test-results',
  'playwright-report',
]);

/**
 * Recursively lists source files below a directory.
 * @param {string} directory Directory to scan.
 * @returns {string[]} Absolute paths of source files.
 */
function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return SKIPPED_DIRECTORIES.has(name) ? [] : listSourceFiles(path);
    }
    return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) ? [path] : [];
  });
}

/**
 * Finds source files that exceed the line limit.
 * @param {string} root Repository root to scan.
 * @param {number} [limit] Maximum allowed lines per file.
 * @returns {{ file: string, lines: number }[]} Offending files with line counts, paths relative to `root`.
 */
export function findOversizeFiles(root, limit = MAX_LINES) {
  return listSourceFiles(root)
    .map((path) => ({
      file: relative(root, path),
      lines: readFileSync(path, 'utf8').split('\n').length,
    }))
    .filter(({ lines }) => lines > limit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const offenders = findOversizeFiles(root);
  for (const { file, lines } of offenders) {
    console.error(`${file}: ${lines} lines (limit ${MAX_LINES})`);
  }
  process.exit(offenders.length > 0 ? 1 : 0);
}
