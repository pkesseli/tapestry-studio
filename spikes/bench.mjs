#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runMeasured } from './lib/bench-run.mjs';
import { upsertClip } from './lib/manifest.mjs';
import { appendRun } from './lib/runs.mjs';

/** The `spikes/` folder. */
const SPIKES = dirname(fileURLToPath(import.meta.url));

/** Default longest run, in minutes. One reported local run took over an hour for two seconds of video. */
const DEFAULT_TIMEOUT_MIN = 45;

const HELP = `Runs a command and records how long it took and how much memory it used.

  node spikes/bench.mjs --candidate <id> [options] -- <command> [arguments...]

Options
  --candidate <id>    Id from spikes/mac/candidates.json (required).
  --suite <name>      mac (default) or draft-final: decides where results go.
  --label <text>      Name of this run (default: candidate and time).
  --shot <id>         Shot from spikes/draft-final/shots.json, if the run makes one.
  --out <file>        File the command should write; a run without it counts as "no-output".
  --meta key=value    Extra facts, repeatable: resolution=832x480 seconds=4 steps=20 quant=q4 seed=1
  --note <text>       Anything worth remembering.
  --timeout-min <n>   Stop the run after n minutes (default ${DEFAULT_TIMEOUT_MIN}); that counts as a result.

Draft and final clips (suite draft-final) also take
  --clip-id <id> --role draft|final --variant <name> --source <draft clip id>
which add the finished clip to results/manifest.json for rating and measuring.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    candidate: { type: 'string' },
    suite: { type: 'string', default: 'mac' },
    label: { type: 'string' },
    shot: { type: 'string' },
    out: { type: 'string' },
    meta: { type: 'string', multiple: true, default: [] },
    note: { type: 'string' },
    'timeout-min': { type: 'string', default: String(DEFAULT_TIMEOUT_MIN) },
    'clip-id': { type: 'string' },
    role: { type: 'string' },
    variant: { type: 'string' },
    source: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.candidate || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 2);
}

const results = join(SPIKES, values.suite, 'results');
const label =
  values.label ?? `${values.candidate}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const meta = Object.fromEntries(
  values.meta.map((pair) => [pair.split('=')[0], pair.split('=').slice(1).join('=')]),
);
const outFile = values.out ? resolve(values.out) : undefined;
if (values['clip-id'] && (!outFile || relative(SPIKES, outFile).startsWith('..'))) {
  console.error(
    'A clip needs --out, and the file must be inside the spikes/ folder (for example under results/out/).',
  );
  process.exit(2);
}

const [command, ...args] = positionals;
const result = await runMeasured({
  command,
  args,
  timeoutMs: Number(values['timeout-min']) * 60_000,
  logFile: join(results, 'logs', `${label}.log`),
  outFile,
});

const systemFile = join(results, 'system.json');
const machine = existsSync(systemFile) ? JSON.parse(readFileSync(systemFile, 'utf8')) : null;
const record = {
  label,
  candidate: values.candidate,
  suite: values.suite,
  shot: values.shot ?? null,
  startedAt: new Date(Date.now() - result.seconds * 1000).toISOString(),
  command: [command, ...args].join(' '),
  meta,
  note: values.note ?? null,
  machine: machine ? `${machine.chip}, ${machine.memoryGiB} GB` : null,
  ...result,
  outputFile: outFile ? relative(SPIKES, outFile) : null,
};
appendRun(join(results, 'runs.jsonl'), record);

if (values['clip-id'] && result.outcome === 'ok') {
  upsertClip(join(results, 'manifest.json'), {
    id: values['clip-id'],
    shot: values.shot,
    role: values.role,
    variant: values.variant ?? null,
    source: values.source ?? null,
    candidate: values.candidate,
    seed: meta.seed ?? null,
    file: relative(SPIKES, outFile).split('\\').join('/'),
    seconds: result.seconds,
    peakBytes: result.peakBytes,
  });
}

const peak = result.peakBytes === null ? 'n/a' : `${(result.peakBytes / 1024 ** 3).toFixed(1)} GB`;
console.log(
  `${record.outcome}: ${Math.round(result.seconds)} s, peak memory ${peak}, log ${join(results, 'logs', `${label}.log`)}`,
);
process.exit(result.outcome === 'ok' ? 0 : 1);
