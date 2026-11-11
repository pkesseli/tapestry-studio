import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runMeasured } from './bench-run.mjs';

/** A fresh folder for logs and outputs. */
const folder = () => mkdtempSync(join(tmpdir(), 'spike-'));

/**
 * Runs a Node snippet as the measured command.
 * @param {string} code JavaScript to run.
 * @param {Record<string, unknown>} [extra] Options that replace the defaults.
 */
const node = (code, extra = {}) =>
  runMeasured({
    command: process.execPath,
    args: ['-e', code],
    timeoutMs: 20_000,
    logFile: join(folder(), 'logs', 'run.log'),
    ...extra,
  });

test('a command that finishes is ok, and its output goes to the log', async () => {
  const logFile = join(folder(), 'logs', 'run.log');
  const result = await node('console.log("hello from the model")', { logFile });
  expect(result).toMatchObject({ outcome: 'ok', exitCode: 0 });
  expect(readFileSync(logFile, 'utf8')).toContain('hello from the model');
});

test('a command that exits with an error is failed', async () => {
  expect(await node('process.exit(3)')).toMatchObject({ outcome: 'failed', exitCode: 3 });
});

test('a program that does not exist is failed, not a crash', async () => {
  const result = await runMeasured({
    command: 'no-such-program-xyz',
    args: [],
    timeoutMs: 5_000,
    logFile: join(folder(), 'run.log'),
  });
  expect(result.outcome).toBe('failed');
});

test('a command that runs too long is stopped and counts as a timeout', async () => {
  const result = await node('setTimeout(() => {}, 60000)', { timeoutMs: 400 });
  expect(result.outcome).toBe('timeout');
  expect(result.seconds).toBeLessThan(10);
});

test('a clean exit without the expected file is no-output, with it is ok', async () => {
  const outFile = join(folder(), 'clip.mp4');
  expect((await node('0', { outFile })).outcome).toBe('no-output');
  const made = await node(`require('fs').writeFileSync(${JSON.stringify(outFile)}, 'x')`, {
    outFile,
  });
  expect(made).toMatchObject({ outcome: 'ok', outputBytes: 1 });
  expect(existsSync(outFile)).toBe(true);
});
