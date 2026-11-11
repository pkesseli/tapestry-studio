import { spawn } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { parseTimeOutput } from './runs.mjs';

/** Largest log kept per run (the end of the output, where errors are). */
const MAX_LOG_BYTES = 300_000;

/**
 * Stops a command and everything it started (model servers and workers often outlive their parent).
 * @param {import('node:child_process').ChildProcess} child The running command.
 * @param {NodeJS.Platform} platform The platform the command runs on.
 */
function killTree(child, platform) {
  try {
    if (platform === 'win32' || child.pid === undefined) child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

/**
 * Keeps only the end of a log file so a chatty model cannot fill the disk or the repository.
 * @param {string} file Log file.
 */
function trimLog(file) {
  const bytes = readFileSync(file);
  if (bytes.length > MAX_LOG_BYTES) {
    writeFileSync(
      file,
      `[... earlier output cut ...]\n${bytes.subarray(bytes.length - MAX_LOG_BYTES)}`,
    );
  }
}

/**
 * Runs one command and measures it: wall time, peak memory (on macOS, through `/usr/bin/time -l`), exit status, and
 * whether it produced the expected output file. A run that takes longer than the limit is stopped and counts as a result
 * ("too slow to be useful") rather than a hang.
 * @param {object} options What to run.
 * @param {string} options.command Program to start.
 * @param {string[]} options.args Its arguments.
 * @param {number} options.timeoutMs Longest allowed run time.
 * @param {string} options.logFile Where the combined output goes (its folder is created).
 * @param {string} [options.outFile] File the command should produce; a run without it counts as `no-output`.
 * @param {string} [options.cwd] Working directory.
 * @param {NodeJS.Platform} [options.platform] Platform to assume (tests only).
 * @returns {Promise<{ outcome: 'ok' | 'failed' | 'timeout' | 'no-output', seconds: number, realSeconds: number | null,
 *   peakBytes: number | null, exitCode: number | null, signal: string | null, outputBytes: number | null }>}
 */
export async function runMeasured({
  command,
  args,
  timeoutMs,
  logFile,
  outFile,
  cwd,
  platform = process.platform,
}) {
  mkdirSync(dirname(logFile), { recursive: true });
  const timed = platform === 'darwin';
  const log = createWriteStream(logFile);
  const started = Date.now();
  const child = spawn(timed ? '/usr/bin/time' : command, timed ? ['-l', command, ...args] : args, {
    cwd,
    detached: platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errorText = '';
  child.stdout.on('data', (chunk) => log.write(chunk));
  child.stderr.on('data', (chunk) => {
    log.write(chunk);
    errorText = (errorText + chunk).slice(-20_000);
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child, platform);
  }, timeoutMs);

  const { exitCode, signal } = await new Promise((resolve) => {
    child.on('error', (error) => {
      log.write(`[could not start: ${error.message}]\n`);
      resolve({ exitCode: 127, signal: null });
    });
    child.on('close', (code, sig) => resolve({ exitCode: code, signal: sig }));
  });
  clearTimeout(timer);
  if (platform !== 'win32' && child.pid !== undefined) killTree(child, platform);
  await new Promise((resolve) => log.end(resolve));
  trimLog(logFile);

  const seconds = (Date.now() - started) / 1000;
  const outputBytes = outFile && existsSync(outFile) ? statSync(outFile).size : null;
  let outcome = 'ok';
  if (timedOut) outcome = 'timeout';
  else if (exitCode !== 0) outcome = 'failed';
  else if (outFile && !outputBytes) outcome = 'no-output';
  return {
    outcome,
    seconds,
    ...(timed ? parseTimeOutput(errorText) : { realSeconds: null, peakBytes: null }),
    exitCode,
    signal,
    outputBytes,
  };
}
