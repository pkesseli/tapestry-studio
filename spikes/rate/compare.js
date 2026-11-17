import { sidesFor } from '../lib/compare.mjs';

/** How long after the last click the answer is sent to be saved, in milliseconds. */
const SAVE_DELAY_MS = 400;

const app = document.getElementById('app');
let pairs = [];
let shotInfo = {};
let rater = '';
let data = { answers: {} };
let position = 0;
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
 * Fetches JSON, treating a missing file as the fallback.
 * @param {string} url Address.
 * @param {any} fallback Value when the file is not there.
 */
async function load(url, fallback) {
  const response = await fetch(url, { cache: 'no-store' });
  return response.ok ? response.json() : fallback;
}

/** Sends the answers to the local server shortly after the last change. */
function scheduleSave() {
  const status = document.getElementById('saved');
  if (status) status.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const response = await fetch(`/api/compare/${rater}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const now = document.getElementById('saved');
    if (now)
      now.textContent = response.ok ? 'Saved' : 'Could not save: is the server still running?';
  }, SAVE_DELAY_MS);
}

/**
 * Records an answer for a shot and redraws.
 * @param {string} shot Shot id.
 * @param {string} key `choice` or `note`.
 * @param {string} value The answer.
 * @param {boolean} [redraw] Whether to redraw (not while typing a note).
 */
function answer(shot, key, value, redraw = true) {
  data = { ...data, answers: { ...data.answers, [shot]: { ...data.answers[shot], [key]: value } } };
  scheduleSave();
  if (redraw) render();
}

/** The first screen: who is rating. */
function renderStart() {
  const input = h('input', {
    type: 'text',
    id: 'name',
    placeholder: 'Your first name',
    autocomplete: 'off',
  });
  app.replaceChildren(
    h('h1', {}, 'Which looks better?'),
    h(
      'p',
      {},
      `${pairs.length} shots, each shown twice: two versions of the same moment. For each, pick the one that looks better. ` +
        'You do not know which is which, and it can be a tie. Only the picture counts here, so the sound is switched off. ' +
        'It takes about 10 minutes, and your answers are saved as you click.',
    ),
    h('label', {}, 'Your name ', input),
    h(
      'p',
      {},
      h(
        'button',
        {
          type: 'button',
          class: 'primary',
          onclick: async () => {
            rater = input.value
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 30);
            if (!rater) return input.focus();
            data = { answers: {}, ...(await load(`/api/compare/${rater}`, {})) };
            render();
          },
        },
        'Start',
      ),
    ),
  );
}

/**
 * One video of the pair.
 * @param {string} label "A" or "B".
 * @param {string} file Path below `spikes/`.
 */
function side(label, file) {
  const video = h('video', {
    src: `/${file}`,
    controls: true,
    loop: true,
    playsinline: true,
    preload: 'auto',
    'data-side': label,
  });
  // The attribute alone does not mute a player created from script; the property does. The test is picture only.
  video.muted = true;
  return h('section', { class: 'card' }, h('h2', {}, `Version ${label}`), video);
}

/** Starts both videos from the beginning at the same moment. */
function playBoth() {
  for (const video of document.querySelectorAll('video')) {
    video.muted = true;
    video.currentTime = 0;
    video.play();
  }
}

/** Draws the screen for one shot. */
function render() {
  if (!rater) return renderStart();
  position = Math.max(0, Math.min(position, pairs.length - 1));
  const pair = pairs[position];
  const info = shotInfo[pair.shot];
  const [a, b] = sidesFor(pair.shot, rater);
  const files = { direct: pair.direct, upscaled: pair.upscaled };
  const current = data.answers[pair.shot] ?? {};
  const done = pairs.filter((p) => data.answers[p.shot]?.choice).length;
  const choices = [
    ['A', 'Version A looks better'],
    ['same', "Can't tell / the same"],
    ['B', 'Version B looks better'],
  ];
  app.replaceChildren(
    h(
      'div',
      { class: 'bar' },
      h('strong', {}, `Shot ${position + 1} of ${pairs.length}`),
      h('span', { class: 'muted' }, `${done} of ${pairs.length} answered`),
      h('span', { class: 'grow' }),
      h('span', { id: 'saved', class: 'saved', role: 'status' }, ''),
    ),
    h('h1', {}, info ? info.title : pair.shot),
    info ? h('p', { class: 'prompt muted' }, info.prompt) : '',
    h(
      'div',
      { class: 'bar' },
      h('button', { type: 'button', onclick: playBoth }, '▶ Play both together'),
    ),
    h('div', { class: 'pair' }, side('A', files[a]), side('B', files[b])),
    h(
      'div',
      { class: 'choices', role: 'group', 'aria-label': 'Which looks better?' },
      ...choices.map(([value, text]) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(current.choice === value),
            onclick: () => answer(pair.shot, 'choice', value),
          },
          text,
        ),
      ),
    ),
    h(
      'label',
      {},
      'What made the difference? (optional, e.g. faces, sharpness, flicker) ',
      h(
        'textarea',
        {
          rows: 2,
          onchange: (event) => answer(pair.shot, 'note', event.target.value, false),
        },
        current.note ?? '',
      ),
    ),
    h(
      'div',
      { class: 'bar', style: 'margin-top:20px' },
      h(
        'button',
        {
          type: 'button',
          disabled: position === 0,
          onclick: () => {
            position -= 1;
            render();
            window.scrollTo(0, 0);
          },
        },
        '‹ Previous shot',
      ),
      h('span', { class: 'grow' }),
      h(
        'button',
        {
          type: 'button',
          class: 'primary',
          disabled: position === pairs.length - 1,
          onclick: () => {
            position += 1;
            render();
            window.scrollTo(0, 0);
          },
        },
        'Next shot ›',
      ),
    ),
  );
}

const compare = await load('/draft-final/results/compare.json', { pairs: [] });
pairs = compare.pairs;
const shots = await load('/draft-final/shots.json', { shots: [] });
shotInfo = Object.fromEntries(shots.shots.map((shot) => [shot.id, shot]));
if (pairs.length === 0) {
  app.replaceChildren(h('h1', {}, 'Which looks better?'), h('p', {}, 'Nothing to compare yet.'));
} else render();
