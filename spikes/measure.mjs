#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readManifest } from './lib/manifest.mjs';
import {
  flickerScore,
  mean,
  motionCorrelation,
  parseProbe,
  parseSignalStats,
  parseSsim,
} from './lib/media.mjs';

const run = promisify(execFile);

/** The `spikes/` folder. */
const SPIKES = dirname(fileURLToPath(import.meta.url));

/** Results of the draft and final comparison. */
const RESULTS = join(SPIKES, 'draft-final', 'results');

/** Size used for comparisons: small enough to be quick, large enough to see composition. */
const COMPARE = 'scale=320:180,fps=8,setpts=PTS-STARTPTS';

/** Height of the small preview copies that are committed (the full-size outputs are not). */
const PREVIEW_HEIGHT = 240;

/** Longest preview, in seconds. */
const PREVIEW_SECONDS = 6;

const HELP = `node spikes/measure.mjs <measures|previews>

  measures   Per clip: size, length, flicker, motion, and for finals the similarity to their draft
             (SSIM, 1 = identical) and how closely their motion follows the draft's. Writes results/measures.json.
  previews   Small copies of every clip in results/previews/ (these are committed; the full-size files are not).

Needs ffmpeg and ffprobe (brew install ffmpeg).`;

/**
 * Runs ffmpeg or ffprobe and returns what it printed.
 * @param {string} program ffmpeg or ffprobe.
 * @param {string[]} args Arguments.
 */
async function tool(program, args) {
  try {
    const { stdout, stderr } = await run(program, args, { maxBuffer: 64 * 1024 * 1024 });
    return { stdout, stderr };
  } catch (error) {
    if (error.code === 'ENOENT')
      throw new Error(`${program} is not installed (brew install ffmpeg)`, { cause: error });
    throw new Error(`${program} failed: ${String(error.stderr ?? error.message).slice(-500)}`, {
      cause: error,
    });
  }
}

/**
 * Measures one clip on its own.
 * @param {string} file Path of the video.
 */
async function measureClip(file) {
  const probe = parseProbe(
    (
      await tool('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,r_frame_rate,nb_frames,duration',
        '-of',
        'json',
        file,
      ])
    ).stdout,
  );
  const { stdout } = await tool('ffmpeg', [
    '-v',
    'error',
    '-i',
    file,
    '-vf',
    'scale=96:54,signalstats,metadata=print:file=-',
    '-f',
    'null',
    '-',
  ]);
  const stats = parseSignalStats(stdout);
  return {
    ...probe,
    flicker: flickerScore(stats.brightness),
    motion: mean(stats.change),
    change: stats.change,
  };
}

/**
 * Compares a final with its draft.
 * @param {string} finalFile The final.
 * @param {string} draftFile Its draft.
 */
async function compare(finalFile, draftFile) {
  const { stderr } = await tool('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    finalFile,
    '-i',
    draftFile,
    '-lavfi',
    `[0:v]${COMPARE}[a];[1:v]${COMPARE}[b];[a][b]ssim`,
    '-f',
    'null',
    '-',
  ]);
  return parseSsim(stderr);
}

/** Measures every clip in the manifest and writes `measures.json`. */
async function measures() {
  const { clips } = readManifest(join(RESULTS, 'manifest.json'));
  const own = new Map();
  for (const clip of clips) own.set(clip.id, await measureClip(join(SPIKES, clip.file)));
  const out = {};
  for (const clip of clips) {
    const { change, ...single } = own.get(clip.id);
    const draft = clip.source ? clips.find((c) => c.id === clip.source) : undefined;
    out[clip.id] = {
      ...single,
      ssimToDraft: draft ? await compare(join(SPIKES, clip.file), join(SPIKES, draft.file)) : null,
      motionCorrelationToDraft: draft ? motionCorrelation(own.get(draft.id).change, change) : null,
    };
    console.log(`${clip.id}: ${JSON.stringify(out[clip.id])}`);
  }
  writeFileSync(join(RESULTS, 'measures.json'), `${JSON.stringify(out, null, 2)}\n`);
}

/** Writes a small copy of every clip. */
async function previews() {
  const { clips } = readManifest(join(RESULTS, 'manifest.json'));
  mkdirSync(join(RESULTS, 'previews'), { recursive: true });
  for (const clip of clips) {
    const target = join(RESULTS, 'previews', `${clip.id}.mp4`);
    await tool('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      join(SPIKES, clip.file),
      '-t',
      String(PREVIEW_SECONDS),
      '-vf',
      `scale=-2:${PREVIEW_HEIGHT},fps=12`,
      '-c:v',
      'libx264',
      '-crf',
      '34',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-an',
      target,
    ]);
    console.log(`preview: ${target}`);
  }
}

const command = process.argv[2];
try {
  if (command === 'measures') await measures();
  else if (command === 'previews') await previews();
  else console.log(HELP);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
