import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Bytes in a gibibyte, for reporting memory. */
const GIB = 1024 ** 3;

/**
 * Reads the numbers out of the report that macOS `/usr/bin/time -l` prints at the end of a run. Memory is in bytes on
 * macOS (it is kilobytes on Linux, which is not supported here).
 *
 * The peak is the "peak memory footprint" when the report has it, because on Apple Silicon the resident set size
 * leaves out Metal buffers: measured 2026-11-12 on an M4 Pro, FLUX.2 klein on MLX showed 9.0 GB resident but a
 * 13.4 GB footprint while MLX itself reported 9.3 GB of model memory. The resident size is kept as `rssBytes`.
 * @param {string} text Standard error of the timed command.
 * @returns {{ realSeconds: number | null, peakBytes: number | null, rssBytes: number | null }} What was found; `null`
 *   for what was not.
 */
export function parseTimeOutput(text) {
  const real = /([\d.]+)\s+real/.exec(text);
  const rss = /(\d+)\s+maximum resident set size/.exec(text);
  const footprint = /(\d+)\s+peak memory footprint/.exec(text);
  const rssBytes = rss ? Number(rss[1]) : null;
  return {
    realSeconds: real ? Number(real[1]) : null,
    peakBytes: footprint ? Number(footprint[1]) : rssBytes,
    rssBytes,
  };
}

/**
 * Replaces the home folder in text with `~`, so committed logs and run records do not carry the user's account name
 * (it is part of every absolute path on macOS).
 * @param {string} text Text that may contain absolute paths.
 * @param {string} home Absolute path of the home folder, e.g. `os.homedir()`.
 * @returns {string} The text with every occurrence of `home` replaced.
 */
export function redactHome(text, home) {
  return home ? text.split(home).join('~') : text;
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
