#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Largest file that may be committed from `spikes/`, in bytes. Videos and model files stay out of the repository. */
export const MAX_BYTES = 3 * 1024 * 1024;

/** Extensions that are never committed, whatever their size (model weights and raw outputs). */
export const BLOCKED = ['.safetensors', '.gguf', '.ckpt', '.pt', '.pth', '.bin', '.onnx', '.npz'];

/**
 * Finds files that should not be committed.
 * @param {{ file: string, bytes: number }[]} files Files that would be committed, with sizes.
 * @returns {string[]} A message per offending file.
 */
export function findProblems(files) {
  return files.flatMap(({ file, bytes }) => {
    if (BLOCKED.some((extension) => file.toLowerCase().endsWith(extension))) {
      return [`${file}: model files are never committed`];
    }
    return bytes > MAX_BYTES
      ? [
          `${file}: ${(bytes / 1024 ** 2).toFixed(1)} MB is over the ${MAX_BYTES / 1024 ** 2} MB limit for spikes/`,
        ]
      : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'spikes'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  const files = listed
    .split('\n')
    .filter(Boolean)
    .flatMap((file) => {
      try {
        return [{ file, bytes: statSync(join(root, file)).size }];
      } catch {
        return [];
      }
    });
  const problems = findProblems(files);
  for (const problem of problems) console.error(problem);
  console.log(
    problems.length
      ? 'Fix the files above before committing.'
      : `ok: ${files.length} files in spikes/`,
  );
  process.exit(problems.length ? 1 : 0);
}
