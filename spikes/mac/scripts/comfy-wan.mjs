#!/usr/bin/env node
/**
 * Renders one shot with a Wan model in ComfyUI on PyTorch MPS, as one measurable command for bench.mjs: Wan 2.2
 * TI2V-5B (GGUF, the default), Wan 2.1 T2V 1.3B (fp16) or Wan 2.2 Fun 5B Control (GGUF), chosen with `--model`.
 * Fun Control follows a control video (`--control`, e.g. edges of a draft) and optionally a reference image (`--ref`);
 * it is plan 10b's path D.
 *
 * ComfyUI is a server, so this script starts it, sends one workflow over its local HTTP API, waits for the frames,
 * encodes them to an mp4 with ffmpeg and stops the server. The server runs under its own `/usr/bin/time -l`, whose
 * report is passed through to stderr before bench's report of this driver. `parseTimeOutput` in spikes/lib/runs.mjs
 * takes the first match, so the recorded peak memory is ComfyUI's, not this small driver's.
 *
 *   node spikes/mac/scripts/comfy-wan.mjs --shot S01 --out spikes/mac/results/out/wan-S01.mp4 [--model wan22-5b]
 *     [--seed 1] [--steps n] [--width 832] [--height 480] [--frames n] [--image path.png]
 *     [--control edges.mp4] [--ref person.png]
 *
 * Steps, frames and frame rate default to the model's reference settings (see MODELS); frames cover 4 seconds.
 *
 * The ComfyUI checkout, its virtual environment and the models live in ~/tapestry-spikes/comfyui (see INSTALL-LOG.md).
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

/** Folder holding the ComfyUI checkout (`src/`) and its virtual environment (`.venv/`). */
const COMFY = join(homedir(), 'tapestry-spikes', 'comfyui');

/** Local port for the temporary server; not ComfyUI's default 8188, so a ComfyUI the human runs is not disturbed. */
const PORT = 8199;

/**
 * Per-model files and reference settings (Wan 2.2 TI2V-5B and Wan 2.1 T2V 1.3B ComfyUI examples). `fps` is the rate
 * the model was trained at; `frames` is 4 seconds at that rate on the model's 4n+1 frame grid.
 */
const MODELS = {
  'wan22-5b': {
    unet: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'Wan2.2-TI2V-5B-Q8_0.gguf' } },
    vae: 'split_files/vae/wan2.2_vae.safetensors',
    latent: 'Wan22ImageToVideoLatent',
    steps: 20,
    cfg: 5,
    fps: 24,
    frames: 97,
  },
  'wan21-1.3b': {
    unet: {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: 'split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors',
        weight_dtype: 'default',
      },
    },
    vae: 'split_files/vae/wan_2.1_vae.safetensors',
    latent: 'EmptyHunyuanLatentVideo',
    steps: 30,
    cfg: 6,
    fps: 16,
    frames: 65,
  },
  'wan22-fun-5b-control': {
    unet: {
      class_type: 'UnetLoaderGGUF',
      inputs: { unet_name: 'Wan2.2-Fun-5B-Control-Q8_0.gguf' },
    },
    vae: 'split_files/vae/wan2.2_vae.safetensors',
    latent: 'Wan22FunControlToVideo',
    steps: 20,
    cfg: 5,
    fps: 24,
    frames: 97,
  },
};

/** Negative prompt from the Wan 2.2 reference examples (shortened, English). */
const NEGATIVE =
  'blurry, low quality, static, overexposed, subtitles, text, watermark, worst quality, jpeg artifacts, deformed, ' +
  'extra fingers, poorly drawn hands, poorly drawn face, disfigured, fused fingers, messy background, walking backwards';

const { values } = parseArgs({
  options: {
    shot: { type: 'string' },
    out: { type: 'string' },
    model: { type: 'string', default: 'wan22-5b' },
    seed: { type: 'string', default: '1' },
    steps: { type: 'string' },
    width: { type: 'string', default: '832' },
    height: { type: 'string', default: '480' },
    frames: { type: 'string' },
    image: { type: 'string' },
    control: { type: 'string' },
    ref: { type: 'string' },
  },
});
const model = MODELS[values.model];
const funControl = model?.latent === 'Wan22FunControlToVideo';
if (!values.shot || !values.out || !model) {
  console.error(
    `Usage: comfy-wan.mjs --shot <id> --out <file.mp4> [--model ${Object.keys(MODELS).join('|')}] [--seed n] ` +
      '[--steps n] [--image start.png]',
  );
  process.exit(2);
}
if (values.image && values.model !== 'wan22-5b') {
  console.error('--image needs --model wan22-5b (Wan 2.1 T2V 1.3B is text-only).');
  process.exit(2);
}
if (funControl !== Boolean(values.control) || (values.ref && !funControl)) {
  console.error(
    '--model wan22-fun-5b-control needs --control; --control and --ref need that model.',
  );
  process.exit(2);
}

const prompt = execFileSync(
  'node',
  [new URL('./shot-prompt.mjs', import.meta.url).pathname, values.shot],
  {
    encoding: 'utf8',
  },
).trim();

/**
 * Builds the ComfyUI API-format workflow for the chosen model: model loader, GGUF text encoder, VAE, text-to-video
 * (or image-to-video with Wan 2.2 when a start image was uploaded, or control-video-to-video with Fun Control),
 * frames saved as PNG. Uploaded files are named by what they are, see `upload`.
 * @param {{ start?: string, control?: string, ref?: string }} uploaded Names of files already in ComfyUI's input
 *   folder.
 * @returns {Record<string, { class_type: string, inputs: Record<string, unknown> }>} Nodes keyed by id.
 */
function workflow(uploaded) {
  const nodes = {
    unet: model.unet,
    clip: {
      class_type: 'CLIPLoaderGGUF',
      inputs: { clip_name: 'umt5-xxl-encoder-Q8_0.gguf', type: 'wan' },
    },
    vae: { class_type: 'VAELoader', inputs: { vae_name: model.vae } },
    shift: { class_type: 'ModelSamplingSD3', inputs: { model: ['unet', 0], shift: 8 } },
    pos: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text: prompt } },
    neg: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text: NEGATIVE } },
    latent: {
      class_type: model.latent,
      inputs: {
        // The Wan 2.2 latent node encodes the optional start image, so it needs the VAE; the Wan 2.1 one does not.
        ...(model.latent === 'Wan22ImageToVideoLatent' ? { vae: ['vae', 0] } : {}),
        width: Number(values.width),
        height: Number(values.height),
        length: Number(values.frames ?? model.frames),
        batch_size: 1,
      },
    },
    sample: {
      class_type: 'KSampler',
      inputs: {
        model: ['shift', 0],
        positive: ['pos', 0],
        negative: ['neg', 0],
        latent_image: ['latent', 0],
        seed: Number(values.seed),
        steps: Number(values.steps ?? model.steps),
        cfg: model.cfg,
        sampler_name: 'uni_pc',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['vae', 0] } },
    save: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'frame' } },
  };
  if (uploaded.start) {
    nodes.start = { class_type: 'LoadImage', inputs: { image: uploaded.start } };
    nodes.latent.inputs.start_image = ['start', 0];
  }
  if (funControl) {
    // The Fun Control node takes the text conditioning and returns it with the control attached, so the sampler
    // reads positive, negative and latent from it instead of from the text encoders.
    Object.assign(nodes.latent.inputs, {
      positive: ['pos', 0],
      negative: ['neg', 0],
      vae: ['vae', 0],
    });
    Object.assign(nodes.sample.inputs, {
      positive: ['latent', 0],
      negative: ['latent', 1],
      latent_image: ['latent', 2],
    });
    nodes.controlFile = { class_type: 'LoadVideo', inputs: { file: uploaded.control } };
    nodes.controlFrames = {
      class_type: 'GetVideoComponents',
      inputs: { video: ['controlFile', 0] },
    };
    nodes.latent.inputs.control_video = ['controlFrames', 0];
    if (uploaded.ref) {
      nodes.ref = { class_type: 'LoadImage', inputs: { image: uploaded.ref } };
      nodes.latent.inputs.ref_image = ['ref', 0];
    }
  }
  return nodes;
}

/**
 * Waits until the server answers, or fails after `seconds`.
 * @param {number} seconds Longest wait.
 */
async function waitForServer(seconds) {
  for (let i = 0; i < seconds; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/system_stats`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`ComfyUI did not start within ${seconds} s`);
}

/**
 * Polls the history until the prompt has finished.
 * @param {string} id Prompt id returned by POST /prompt.
 * @returns {Promise<object>} The history entry.
 */
async function waitForPrompt(id) {
  for (;;) {
    const history = await (await fetch(`http://127.0.0.1:${PORT}/history/${id}`)).json();
    const entry = history[id];
    if (entry?.status?.completed) return entry;
    if (entry?.status?.status_str === 'error')
      throw new Error(JSON.stringify(entry.status.messages).slice(0, 2000));
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const work = mkdtempSync(join(tmpdir(), 'comfy-wan-'));
const output = join(work, 'output');
const input = join(work, 'input');
const server = spawn(
  '/usr/bin/time',
  [
    '-l',
    join(COMFY, '.venv', 'bin', 'python'),
    'main.py',
    '--listen',
    '127.0.0.1',
    '--port',
    String(PORT),
    '--output-directory',
    output,
    '--input-directory',
    input,
    '--disable-auto-launch',
  ],
  // Same process group as this driver, so bench.mjs's time limit (SIGKILL to the group) also stops the server.
  { cwd: join(COMFY, 'src'), stdio: ['ignore', 'inherit', 'inherit'] },
);
const serverDone = new Promise((r) => server.on('close', r));

let failed = false;
try {
  await waitForServer(300);
  const uploaded = {};
  for (const [role, file, ext] of [
    ['start', values.image, '.png'],
    ['control', values.control, '.mp4'],
    ['ref', values.ref, '.png'],
  ]) {
    if (!file) continue;
    execFileSync('mkdir', ['-p', input]);
    uploaded[role] = `${role}${ext}`;
    copyFileSync(resolve(file), join(input, uploaded[role]));
  }
  const res = await fetch(`http://127.0.0.1:${PORT}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow(uploaded) }),
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(`ComfyUI rejected the workflow: ${JSON.stringify(body).slice(0, 2000)}`);
  await waitForPrompt(body.prompt_id);
  const frames = readdirSync(output)
    .filter((f) => f.startsWith('frame') && f.endsWith('.png'))
    .sort();
  console.log(`frames: ${frames.length}`);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-framerate',
    String(model.fps),
    '-pattern_type',
    'glob',
    '-i',
    join(output, 'frame_*.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '18',
    resolve(values.out),
  ]);
} catch (error) {
  console.error(String(error));
  failed = true;
} finally {
  // `time` ignores SIGINT, so stop its child, the ComfyUI process; `time` then prints its report and exits.
  try {
    execFileSync('pkill', ['-INT', '-P', String(server.pid)]);
  } catch {
    // Server already gone.
  }
  await serverDone;
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
