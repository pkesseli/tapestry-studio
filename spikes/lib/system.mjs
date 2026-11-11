import { execFileSync } from 'node:child_process';

/** Bytes in a gibibyte. */
const GIB = 1024 ** 3;

/** Tools whose versions are recorded, with the arguments that print them. */
const TOOLS = [
  ['node', ['--version']],
  ['python3', ['--version']],
  ['pip3', ['--version']],
  ['uv', ['--version']],
  ['git', ['--version']],
  ['brew', ['--version']],
  ['ffmpeg', ['-version']],
  ['ffprobe', ['-version']],
];

/**
 * Runs a program and returns its first line of output, or `null` when it is missing or fails.
 * @param {string} program Program name.
 * @param {string[]} args Arguments.
 * @returns {string | null} The first non-empty output line.
 */
export function firstLine(program, args) {
  try {
    const text = execFileSync(program, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return (
      text
        .split('\n')
        .find((line) => line.trim() !== '')
        ?.trim() ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Reads the number of GPU cores out of `system_profiler SPDisplaysDataType` text.
 * @param {string} text Output of the command.
 * @returns {number | null} The core count, or `null` when not listed.
 */
export function parseGpuCores(text) {
  const match = /Total Number of Cores:\s*(\d+)/.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * Free space on the disk that holds the current folder.
 * @returns {number | null} Gibibytes, or `null` when `df` is not available.
 */
function freeDiskGiB() {
  try {
    const output = execFileSync('df', ['-k', '.'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const freeKiB = Number(output.split('\n')[1]?.trim().split(/\s+/)[3]);
    return Number.isFinite(freeKiB) ? Math.round(freeKiB / 1024 / 1024) : null;
  } catch {
    return null;
  }
}

/**
 * Describes this computer for the results table, so measurements can be compared across machines.
 * @returns {Record<string, unknown>} Chip, memory, operating system, tool versions and free disk space. Anything that
 * cannot be read (for example on a non-Mac) is `null`.
 */
export function collectSystem() {
  const mac = process.platform === 'darwin';
  const memBytes = mac ? Number(firstLine('sysctl', ['-n', 'hw.memsize'])) : null;
  let gpuCores = null;
  if (mac) {
    try {
      gpuCores = parseGpuCores(
        execFileSync('system_profiler', ['SPDisplaysDataType'], { encoding: 'utf8' }),
      );
    } catch {
      gpuCores = null;
    }
  }
  return {
    capturedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    chip: mac ? firstLine('sysctl', ['-n', 'machdep.cpu.brand_string']) : null,
    memoryGiB: memBytes ? Math.round(memBytes / GIB) : null,
    gpuCores,
    macOS: mac ? firstLine('sw_vers', ['-productVersion']) : null,
    freeDiskGiB: freeDiskGiB(),
    tools: Object.fromEntries(TOOLS.map(([program, args]) => [program, firstLine(program, args)])),
  };
}
