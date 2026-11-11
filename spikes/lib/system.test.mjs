import { expect, test } from 'vitest';
import { collectSystem, parseGpuCores } from './system.mjs';

test('reads the GPU core count from system_profiler text', () => {
  const text =
    'Graphics/Displays:\n    Apple M4 Pro:\n      Chipset Model: Apple M4 Pro\n      Total Number of Cores: 20\n';
  expect(parseGpuCores(text)).toBe(20);
  expect(parseGpuCores('nothing')).toBeNull();
});

test('describing this computer never throws and always names the tools it looked for', () => {
  const system = collectSystem();
  expect(system.platform).toBe(process.platform);
  expect(Object.keys(system.tools)).toEqual(expect.arrayContaining(['node', 'ffmpeg', 'python3']));
  expect(system.tools.node).toMatch(/^v\d+/);
});
