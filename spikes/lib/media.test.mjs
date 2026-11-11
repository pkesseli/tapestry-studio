import { expect, test } from 'vitest';
import {
  correlation,
  flickerScore,
  mean,
  motionCorrelation,
  parseProbe,
  parseSignalStats,
  parseSsim,
  resample,
} from './media.mjs';

test('reads size, frames and frame rate from ffprobe json', () => {
  const json = JSON.stringify({
    streams: [{ width: 832, height: 480, r_frame_rate: '24/1', nb_frames: '97', duration: '4.04' }],
  });
  expect(parseProbe(json)).toEqual({ width: 832, height: 480, fps: 24, frames: 97, seconds: 4.04 });
});

test('takes the overall ssim from the last summary line', () => {
  const text = '[Parsed_ssim_4] SSIM Y:0.91 (10.5) U:0.95 (13.0) V:0.95 (13.1) All:0.923456 (11.2)';
  expect(parseSsim(text)).toBe(0.923456);
  expect(parseSsim('no summary')).toBeNull();
});

test('reads brightness and frame change from signalstats metadata', () => {
  const text = [
    'frame:0 pts:0 pts_time:0',
    'lavfi.signalstats.YAVG=100.5',
    'lavfi.signalstats.YDIF=0.0',
    'frame:1 pts:1 pts_time:0.04',
    'lavfi.signalstats.YAVG=101.5',
    'lavfi.signalstats.YDIF=2.5',
  ].join('\n');
  expect(parseSignalStats(text)).toEqual({ brightness: [100.5, 101.5], change: [0, 2.5] });
});

test('flicker is the average brightness step', () => {
  expect(flickerScore([100, 100, 100])).toBe(0);
  expect(flickerScore([100, 110, 100, 110])).toBe(10);
  expect(flickerScore([100])).toBeNull();
  expect(mean([])).toBeNull();
});

test('correlation is 1 for the same shape, -1 for opposite, null for flat', () => {
  expect(correlation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  expect(correlation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  expect(correlation([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
});

test('motion of clips with different frame counts is compared after resampling', () => {
  const draft = [0, 1, 4, 9, 4, 1, 0, 0];
  const final = draft.flatMap((v) => [v, v]);
  expect(resample(final, 8)).toEqual(draft);
  expect(motionCorrelation(draft, final)).toBeCloseTo(1);
});
