import { USABLE_CHOICES, groupByShot, progress, questionsFor, setAnswer } from './logic.mjs';

/** Where the data lives, as served by `serve.mjs`. */
const RESULTS = '/draft-final/results';

/** How long after the last click the answers are sent to be saved, in milliseconds. */
const SAVE_DELAY_MS = 400;

const app = document.getElementById('app');
let manifest = { clips: [] };
let shotInfo = {};
let order = [];
let rater = '';
let ratings = {};
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
    else if (key === 'class') node.className = value;
    else if (value !== false && value !== undefined)
      node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

/**
 * Fetches JSON, treating a missing file as empty.
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
    const response = await fetch(`/api/ratings/${rater}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ratings),
    });
    const now = document.getElementById('saved');
    if (now)
      now.textContent = response.ok ? 'Saved' : 'Could not save: is the server still running?';
  }, SAVE_DELAY_MS);
}

/**
 * Records an answer and refreshes the screen.
 * @param {string} clipId Clip.
 * @param {string} key Question.
 * @param {number | string} value Answer.
 */
function answer(clipId, key, value) {
  ratings = setAnswer(ratings, clipId, key, value);
  scheduleSave();
  render();
}

/**
 * A row of buttons for one question.
 * @param {Record<string, any>} clip Clip being rated.
 * @param {{ key: string, text: string, low: string, high: string }} question The question.
 */
function scale(clip, question) {
  const current = ratings.clips?.[clip.id]?.[question.key];
  return h(
    'div',
    { class: 'question', role: 'group', 'aria-label': question.text },
    h('div', {}, question.text),
    h(
      'div',
      { class: 'scale' },
      ...[1, 2, 3, 4, 5].map((n) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(current === n),
            onclick: () => answer(clip.id, question.key, n),
          },
          String(n),
        ),
      ),
    ),
    h('div', { class: 'ends' }, h('span', {}, question.low), h('span', {}, question.high)),
  );
}

/**
 * The card for one clip: the video and its questions.
 * @param {Record<string, any>} clip The clip.
 * @param {number} index Position among the versions shown (the label never says how the clip was made).
 */
function clipCard(clip, index) {
  const answers = ratings.clips?.[clip.id] ?? {};
  const kind = clip.role === 'draft' ? 'Draft' : 'Version';
  const card = h(
    'section',
    { class: 'card' },
    h('h2', {}, `${kind} ${index + 1}`),
    h('video', {
      src: `/${clip.file}`,
      controls: true,
      loop: true,
      muted: true,
      playsinline: true,
      preload: 'auto',
      // The full-size file is not in the repository: fall back to the small committed copy.
      onerror: (event) => {
        const fallback = `${RESULTS}/previews/${clip.id}.mp4`;
        if (!event.target.src.endsWith(fallback)) event.target.src = fallback;
      },
    }),
    ...questionsFor(clip).map((question) => scale(clip, question)),
  );
  if (clip.role === 'final') {
    card.append(
      h(
        'div',
        { class: 'question', role: 'group', 'aria-label': 'Would you use it?' },
        h('div', {}, 'Would you accept this as the shot?'),
        h(
          'div',
          { class: 'scale' },
          ...USABLE_CHOICES.map((choice) =>
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': String(answers.usable === choice.value),
                onclick: () => answer(clip.id, 'usable', choice.value),
              },
              choice.text,
            ),
          ),
        ),
      ),
    );
  }
  card.append(
    h(
      'label',
      { class: 'question' },
      'Anything else? ',
      h(
        'textarea',
        { rows: 2, onchange: (event) => answer(clip.id, 'notes', event.target.value) },
        answers.notes ?? '',
      ),
    ),
  );
  return card;
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
    h('h1', {}, 'Rate the shots'),
    h(
      'p',
      { class: 'muted' },
      `${manifest.clips.length} short clips to look at. It takes a while: you can stop any time and come back, your answers are kept.`,
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
            ratings = await load(`/api/ratings/${rater}`, {});
            render();
          },
        },
        'Start',
      ),
    ),
  );
}

/** The screen for one shot. */
function render() {
  if (!rater) return renderStart();
  const groups = groupByShot(manifest, order, rater);
  if (groups.length === 0) return app.replaceChildren(h('p', {}, 'No clips yet: nothing to rate.'));
  position = Math.max(0, Math.min(position, groups.length - 1));
  const group = groups[position];
  const info = shotInfo[group.shot];
  const { done, total } = progress(ratings, manifest.clips);
  app.replaceChildren(
    h(
      'div',
      { class: 'bar' },
      h('strong', {}, `Shot ${position + 1} of ${groups.length}`),
      h('span', { class: 'muted' }, `${done} of ${total} clips rated`),
      h('span', { class: 'grow' }),
      h('span', { id: 'saved', class: 'saved', role: 'status' }, ''),
    ),
    h('h1', {}, info ? info.title : group.shot),
    info ? h('p', { class: 'prompt muted' }, info.prompt) : '',
    group.drafts.length ? h('h2', {}, 'Drafts') : '',
    h('div', { class: 'cards' }, ...group.drafts.map(clipCard)),
    group.finals.length ? h('h2', { style: 'margin-top:24px' }, 'Finished versions') : '',
    h('div', { class: 'cards' }, ...group.finals.map(clipCard)),
    h(
      'div',
      { class: 'bar', style: 'margin-top:24px' },
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
          disabled: position === groups.length - 1,
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

manifest = await load(`${RESULTS}/manifest.json`, { clips: [] });
const measures = await load(`${RESULTS}/measures.json`, {});
for (const clip of manifest.clips) clip.measures = measures[clip.id];
const shots = await load('/draft-final/shots.json', { shots: [] });
order = shots.shots.map((shot) => shot.id);
shotInfo = Object.fromEntries(shots.shots.map((shot) => [shot.id, shot]));
render();
