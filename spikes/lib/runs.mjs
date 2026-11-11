import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Bytes in a gibibyte, for reporting memory. */
const GIB = 1024 ** 3;

/**
 * Reads the numbers out of the report that macOS `/usr/bin/time -l` prints at the end of a run. The peak memory is in
 * bytes on macOS (it is kilobytes on Linux, which is not supported here).
 * @param {string} text Standard error of the timed command.
 * @returns {{ realSeconds: number | null, peakBytes: number | null }} What was found; `null` for what was not.
 */
export function parseTimeOutput(text) {
  const real = /([\d.]+)\s+real/.exec(text);
  const peak = /(\d+)\s+maximum resident set size/.exec(text);
  return {
    realSeconds: real ? Number(real[1]) : null,
    peakBytes: peak ? Number(peak[1]) : null,
  };
}

/**
 * Appends one run to a log of runs (one JSON object per line, so a crash never corrupts earlier lines).
 * @param {string} file Path of the `.jsonl` file; its folder is created when missing.
 * @param {Record<string, unknown>} record The run.
 */
export function appendRun(file, record) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`);
}

/**
 * Reads a log of runs. Lines that are not valid JSON are skipped.
 * @param {string} file Path of the `.jsonl` file.
 * @returns {Record<string, any>[]} The runs in the order they were made; empty when the file does not exist.
 */
export function readRuns(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        return line.trim() ? [JSON.parse(line)] : [];
      } catch {
        return [];
      }
    });
}

/**
 * The middle value of a list of numbers.
 * @param {number[]} values At least one number.
 * @returns {number} The median (the mean of the two middle values for an even count).
 */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Sums up the runs of one candidate.
 * @param {Record<string, any>[]} runs Runs of that candidate.
 * @returns {{ runs: number, ok: number, failed: number, timedOut: number, noOutput: number,
 *   medianSeconds: number | null, peakGiB: number | null }} Counts by outcome, the median wall time of the successful
 * runs and the largest peak memory seen in any run.
 */
export function summarizeRuns(runs) {
  const count = (outcome) => runs.filter((run) => run.outcome === outcome).length;
  const seconds = runs.filter((run) => run.outcome === 'ok').map((run) => run.seconds);
  const peaks = runs.map((run) => run.peakBytes).filter((bytes) => typeof bytes === 'number');
  return {
    runs: runs.length,
    ok: count('ok'),
    failed: count('failed'),
    timedOut: count('timeout'),
    noOutput: count('no-output'),
    medianSeconds: seconds.length ? median(seconds) : null,
    peakGiB: peaks.length ? Math.max(...peaks) / GIB : null,
  };
}
