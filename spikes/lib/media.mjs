/**
 * Parsing and arithmetic for the measurements taken with `ffmpeg` and `ffprobe`. Kept free of process handling so it can
 * be tested with sample output.
 */

/**
 * Reads the stream facts out of `ffprobe -of json -show_entries stream=...` output.
 * @param {string} json Output of ffprobe.
 * @returns {{ width: number, height: number, frames: number | null, seconds: number | null, fps: number | null }}
 */
export function parseProbe(json) {
  const stream = JSON.parse(json).streams?.[0] ?? {};
  const [num, den] = String(stream.r_frame_rate ?? '')
    .split('/')
    .map(Number);
  const fps = num && den ? num / den : null;
  const frames = stream.nb_frames ? Number(stream.nb_frames) : null;
  const seconds = stream.duration ? Number(stream.duration) : null;
  return { width: Number(stream.width), height: Number(stream.height), frames, seconds, fps };
}

/**
 * Reads the overall similarity from the `ssim` filter's summary line, for example
 * `SSIM Y:0.91 U:0.95 V:0.95 All:0.923456 (11.2)`.
 * @param {string} text Standard error of ffmpeg.
 * @returns {number | null} A value from 0 to 1, higher meaning more alike; `null` when there is no summary.
 */
export function parseSsim(text) {
  const matches = [...text.matchAll(/All:([\d.]+)/g)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

/**
 * Reads per-frame brightness and frame-to-frame change from `signalstats` output printed with `metadata=print`.
 * @param {string} text The printed metadata lines.
 * @returns {{ brightness: number[], change: number[] }} One value per frame for each (`change` is the average
 * difference to the previous frame; the first frame has none).
 */
export function parseSignalStats(text) {
  const values = (key) =>
    [...text.matchAll(new RegExp(`lavfi\\.signalstats\\.${key}=([\\d.]+)`, 'g'))].map((m) =>
      Number(m[1]),
    );
  return { brightness: values('YAVG'), change: values('YDIF') };
}

/**
 * Average of a list.
 * @param {number[]} values Numbers.
 * @returns {number | null} The mean, or `null` for an empty list.
 */
export function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * How much the picture's brightness jumps from one frame to the next: the average absolute step of the per-frame
 * brightness. Smooth footage scores low; flickering footage scores high. Real camera moves and cuts also raise it a
 * little, so compare it between versions of the same shot, not across shots.
 * @param {number[]} brightness Per-frame average brightness.
 * @returns {number | null} The flicker score, or `null` with fewer than two frames.
 */
export function flickerScore(brightness) {
  if (brightness.length < 2) return null;
  const steps = brightness.slice(1).map((value, i) => Math.abs(value - brightness[i]));
  return mean(steps);
}

/**
 * Stretches or squeezes a series to a given length by nearest-neighbour sampling, so series from clips with different
 * frame rates can be compared.
 * @param {number[]} values The series.
 * @param {number} length Wanted length.
 * @returns {number[]} The resampled series.
 */
export function resample(values, length) {
  if (values.length === 0 || length <= 0) return [];
  return Array.from(
    { length },
    (_, i) => values[Math.min(values.length - 1, Math.floor((i * values.length) / length))],
  );
}

/**
 * Pearson correlation of two series of equal length.
 * @param {number[]} a First series.
 * @param {number[]} b Second series.
 * @returns {number | null} A value from -1 to 1, or `null` when either series is flat or too short.
 */
export function correlation(a, b) {
  if (a.length !== b.length || a.length < 3) return null;
  const meanA = mean(a);
  const meanB = mean(b);
  let both = 0;
  let varA = 0;
  let varB = 0;
  a.forEach((x, i) => {
    both += (x - meanA) * (b[i] - meanB);
    varA += (x - meanA) ** 2;
    varB += (b[i] - meanB) ** 2;
  });
  return varA === 0 || varB === 0 ? null : both / Math.sqrt(varA * varB);
}

/**
 * How closely a final's motion follows its draft's: the correlation of the two "frame change" curves over time. A final
 * that moves when the draft moves and rests when it rests scores near 1.
 * @param {number[]} draftChange Per-frame change of the draft.
 * @param {number[]} finalChange Per-frame change of the final.
 * @returns {number | null} The motion correlation, or `null` when it cannot be computed.
 */
export function motionCorrelation(draftChange, finalChange) {
  const length = Math.min(draftChange.length, finalChange.length, 64);
  return correlation(resample(draftChange, length), resample(finalChange, length));
}
