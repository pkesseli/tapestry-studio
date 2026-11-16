import { parseCsv, toCsv } from '../lib/csv.mjs';

/** How long after the last change the scores are sent to be saved, in milliseconds. */
const SAVE_DELAY_MS = 400;

/** Words under the ends of the 1 to 5 scale. */
const SCALE_ENDS = ['Poor', 'Excellent'];

/**
 * What to judge, per folder of a package. Plain words for the person rating; the names of the files say how each clip
 * was made, so they are not hidden here.
 */
const GUIDE = {
  minimax: [
    'One score per clip: how good is it as a take of the shot described under the heading? Does it show what the prompt says, does it look good, is the sound usable (these clips have sound)? 1 = unusable, 3 = okay, 5 = I would use it.',
    'The file name says how it was made: t2v = from the text only; r2v = also given the reference pictures of Maria, Tom and the ferry deck; turbo = fast (15 to 18 minutes), full = slow (about 50 minutes).',
    'The point is to compare. With r2v, are the people recognisable as the reference pictures? Is full clearly better than turbo, enough to be worth three times the time? Put it in the notes when you see a difference.',
  ],
  music: [
    'One score per piece: how well does it fit the brief under the heading? M1 to M4 are 30 second film cues, M5 is a 60 second song: does it sing the lyrics clearly?',
    'The file name says how it was made: acestep or musicgen is the model. lm0.6B, lm1.7B, lm4B and lmnone are the size of its planning model (bigger = slower, maybe better). sft = slower 50-step version, xl-turbo = the large model (about three times the time), s2 = a second try of the same thing.',
    'The point is to compare: is a bigger or slower one audibly better, and is it worth the extra time? Say so in the notes.',
  ],
};

/** What each comparison sheet shows and what it is for, by file name; unknown sheets get no explanation. */
const SHEET_HELP = {
  'reference-vs-text-sheet.png':
    'Stills side by side: the reference picture, the clip made from text only, and the clip made with the reference. A quick check: does the reference keep the people recognisable?',
  'turbo-vs-full-sheet.png':
    'Stills side by side: text only (turbo | full), then with reference (turbo | full). A quick check: is the slow full version clearly better than the fast turbo one?',
};

const app = document.getElementById('app');
let pkg = null;
let rows = [];
let titles = {};
let saveTimer;

/**
 * Builds an element.
 * @param {string} tag Tag name.
 * @param {Record<string, any>} [props] Attributes and properties (`on…` entries are event handlers).
 * @param {...(Node | string)} children Content.
 */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== undefined)
      node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

/**
 * Fetches text, treating a missing file as empty.
 * @param {string} url Address.
 */
async function text(url) {
  const response = await fetch(url, { cache: 'no-store' });
  return response.ok ? response.text() : '';
}

/** Sends all scores to the local server shortly after the last change. */
function scheduleSave() {
  const status = document.getElementById('saved');
  if (status) status.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const csv = toCsv([
      ['file', 'score_1_to_5', 'notes'],
      ...rows.map((r) => [r.file, r.score, r.notes]),
    ]);
    const response = await fetch('/api/package-csv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dir: pkg.dir, csv }),
    });
    const now = document.getElementById('saved');
    if (now)
      now.textContent = response.ok ? 'Saved' : 'Could not save: is the server still running?';
  }, SAVE_DELAY_MS);
}

/**
 * The player for a file: video, audio or picture, by its extension.
 * @param {string} file Path inside the package.
 */
function player(file) {
  const src = `/${pkg.dir}/${file}`;
  if (/\.(mp4|webm|mov)$/i.test(file))
    return h('video', { src, controls: true, loop: true, playsinline: true, preload: 'metadata' });
  if (/\.(wav|mp3|m4a|ogg)$/i.test(file))
    return h('audio', { src, controls: true, preload: 'none' });
  return h('img', { src, alt: file });
}

/**
 * The card for one row: player, 1 to 5 buttons, notes.
 * @param {{ file: string, score: string, notes: string }} row The row.
 */
function card(row) {
  const buttons = [1, 2, 3, 4, 5].map((n) =>
    h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(row.score === String(n)),
        onclick: (event) => {
          row.score = row.score === String(n) ? '' : String(n);
          for (const [i, button] of [...event.currentTarget.parentElement.children].entries()) {
            button.setAttribute('aria-pressed', String(row.score === String(i + 1)));
          }
          showProgress();
          scheduleSave();
        },
      },
      String(n),
    ),
  );
  return h(
    'section',
    { class: 'card' },
    h('h3', {}, row.file.split('/').pop()),
    player(row.file),
    h('div', { class: 'scale', role: 'group', 'aria-label': `Score for ${row.file}` }, ...buttons),
    h('div', { class: 'ends' }, h('span', {}, SCALE_ENDS[0]), h('span', {}, SCALE_ENDS[1])),
    h(
      'textarea',
      {
        rows: 2,
        placeholder: 'Notes (optional)',
        oninput: (event) => {
          row.notes = event.target.value;
          scheduleSave();
        },
      },
      row.notes,
    ),
  );
}

/** Updates the "n of m scored" counter. */
function showProgress() {
  const done = rows.filter((row) => row.score !== '').length;
  document.getElementById('progress').textContent = `${done} of ${rows.length} scored`;
}

/**
 * Splits the rows into groups that belong together (the same shot, or the same music brief), keeping the file order.
 * @returns {{ key: string, folder: string, id: string | null, rows: typeof rows }[]}
 */
function groups() {
  const result = [];
  for (const row of rows) {
    const [folder] = row.file.split('/');
    const id = /(S\d\d|M\d)-s\d/.exec(row.file)?.[1] ?? null;
    const key = `${folder}/${id}`;
    let group = result.find((g) => g.key === key);
    if (!group) result.push((group = { key, folder, id, rows: [] }));
    group.rows.push(row);
  }
  return result;
}

/** Draws the whole page. */
function render() {
  const sheets = pkg.sheets.map((sheet) =>
    h(
      'details',
      {},
      h('summary', {}, `Comparison sheet: ${sheet.split('/').pop()}`),
      h(
        'p',
        { class: 'muted' },
        SHEET_HELP[sheet.split('/').pop()] ?? 'Stills from several clips side by side.',
      ),
      h('img', { src: `/${pkg.dir}/${sheet}`, alt: sheet }),
    ),
  );
  const nodes = [
    h(
      'div',
      { class: 'bar' },
      h('strong', { id: 'progress' }, ''),
      h('span', { class: 'grow' }),
      h('span', { id: 'saved', class: 'saved', role: 'status' }, ''),
    ),
    h('h1', {}, 'Score the clips'),
    h(
      'p',
      { class: 'muted' },
      'Give each clip a score from 1 to 5 and, if you like, a note. Your scores are saved as you click; there is no file to send.',
    ),
    ...(pkg.howTo
      ? [
          h(
            'details',
            {},
            h(
              'summary',
              {},
              'Original notes from the Mac session (ignore the file and CSV steps: this page saves for you)',
            ),
            h('pre', {}, pkg.howToText),
          ),
        ]
      : []),
    ...sheets,
  ];
  const guided = new Set();
  for (const group of groups()) {
    const info = titles[group.id];
    if (GUIDE[group.folder] && !guided.has(group.folder)) {
      guided.add(group.folder);
      nodes.push(
        h('h2', {}, `${group.folder}: what to judge`),
        h('div', { class: 'card' }, ...GUIDE[group.folder].map((line) => h('p', {}, line))),
      );
    }
    nodes.push(h('h2', {}, `${group.folder} · ${info ? info.title : (group.id ?? 'other')}`));
    if (info?.text) nodes.push(h('p', { class: 'prompt muted' }, info.text));
    nodes.push(h('div', { class: 'cards' }, ...group.rows.map(card)));
  }
  app.replaceChildren(...nodes);
  showProgress();
}

const packages = await (await fetch('/api/packages', { cache: 'no-store' })).json();
if (packages.length === 0) {
  app.replaceChildren(
    h('h1', {}, 'Score the clips'),
    h('p', {}, 'No package found. Extract it into spikes/incoming/ first.'),
  );
} else {
  const wanted = new URLSearchParams(location.search).get('dir');
  pkg = packages.find((p) => p.dir === wanted) ?? packages[packages.length - 1];
  pkg.howToText = pkg.howTo ? await text(`/${pkg.dir}/HOW-TO-RATE.txt`) : '';
  const [, ...body] = parseCsv(await text(`/${pkg.dir}/ratings.csv`));
  rows = body.map(([file, score = '', notes = '']) => ({ file, score, notes }));
  const shots = JSON.parse((await text('/draft-final/shots.json')) || '{"shots":[]}');
  const cues = JSON.parse((await text('/music/cues.json')) || '{"cues":[]}');
  titles = {
    ...Object.fromEntries(
      shots.shots.map((s) => [s.id, { title: `${s.id} ${s.title}`, text: s.prompt }]),
    ),
    ...Object.fromEntries(
      cues.cues.map((c) => [c.id, { title: `${c.id} ${c.name}`, text: c.caption }]),
    ),
  };
  render();
}
