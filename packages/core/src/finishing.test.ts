import { expect, test } from 'vitest';
import {
  UNTESTED_ACCEPT_RANGE,
  acceptRange,
  classifyShot,
  estimateFinishing,
  filmShots,
  finalRequestFromDraft,
  selectPreviewShots,
  shotsInScope,
} from './finishing';
import type { FilmShot } from './finishing';
import { JobSchema } from './schema/jobs';
import type { Job } from './schema/jobs';
import type { Shot } from './schema/units';
import { buildSampleFilm, sampleId } from './testing';
import { validateProject } from './validate';

/** The sample film's accepted job, made into an accepted draft with a size and provider settings. */
function acceptedDraft(): Job {
  const [job] = buildSampleFilm().jobs;
  if (!job) throw new Error('sample data changed');
  return {
    ...job,
    request: {
      ...job.request,
      quality: 'draft',
      width: 416,
      height: 224,
      extras: { ltx: { steps: 4 } },
    },
  };
}

test('the final follows the draft: same prompt, references and seed, its own size and settings', () => {
  const draft = acceptedDraft();
  const result = finalRequestFromDraft(draft);
  if (!result.ok) throw new Error(result.reason);
  expect(result.sourceJobId).toBe(draft.id);
  expect(result.request).toMatchObject({
    prompt: draft.request.prompt,
    references: draft.request.references,
    seed: 7,
    durationSeconds: 6,
    quality: 'final',
    extras: {},
  });
  expect(result.request).not.toHaveProperty('width');
  expect(result.request).not.toHaveProperty('height');
  expect(draft.request.width).toBe(416);
});

test('only an accepted draft with a seed can be followed', () => {
  const draft = acceptedDraft();
  const reason = (job: Job) => {
    const result = finalRequestFromDraft(job);
    return result.ok ? 'ok' : result.reason;
  };
  expect(reason({ ...draft, state: 'rendered' })).toMatch(/not been accepted/);
  expect(reason({ ...draft, request: { ...draft.request, quality: 'final' } })).toMatch(
    /not a draft/,
  );
  const { seed: _seed, ...noSeed } = draft.request;
  expect(reason({ ...draft, request: noSeed })).toMatch(/no seed/);
  expect(reason(draft)).toBe('ok');
});

test('jobs written before the new fields existed still load, and the new fields round-trip', () => {
  const [old] = buildSampleFilm().jobs;
  expect(JobSchema.parse(old)).toEqual(old);
  const draft = acceptedDraft();
  const final = {
    ...draft,
    id: sampleId('job', 2),
    sourceJobId: draft.id,
    request: { ...draft.request, quality: 'final' as const },
  };
  expect(JobSchema.parse(final)).toEqual(final);
});

test('a final that follows a missing job or itself is reported', () => {
  const film = buildSampleFilm();
  const [job] = film.jobs;
  if (!job) throw new Error('sample data changed');
  film.jobs = [{ ...job, sourceJobId: sampleId('job', 99) }];
  expect(validateProject(film).map((i) => i.message)).toContain(
    `Unknown source job ${sampleId('job', 99)}`,
  );
  film.jobs = [{ ...job, sourceJobId: job.id }];
  expect(validateProject(film).map((i) => i.message)).toContain('A job cannot follow itself');
});

/** A shot with just the fields that matter here. */
const shot = (n: number, extra: Partial<Shot> = {}): Shot => ({
  id: sampleId('sht', n),
  action: 'Something happens.',
  dialogue: [],
  durationSeconds: 4,
  referenceEntityIds: [],
  ...extra,
});

const people = new Set<string>([sampleId('chr', 1)]);

test('shots are classified by people and camera move, not by words in the action', () => {
  expect(classifyShot(shot(1), people)).toEqual({ people: false, cameraMove: false });
  expect(classifyShot(shot(1, { referenceEntityIds: [sampleId('chr', 1)] }), people).people).toBe(
    true,
  );
  expect(
    classifyShot(
      shot(1, {
        dialogue: [{ id: sampleId('lin', 1), speakerId: sampleId('chr', 1), text: 'Hi' }],
      }),
      people,
    ).people,
  ).toBe(true);
  expect(classifyShot(shot(1, { direction: 'slow push-in, fog' }), people).cameraMove).toBe(true);
  expect(
    classifyShot(shot(1, { cameraHint: 'tracking shot from behind' }), people).cameraMove,
  ).toBe(true);
  expect(classifyShot(shot(1, { direction: 'locked-off camera' }), people).cameraMove).toBe(false);
  expect(classifyShot(shot(1, { action: 'She follows the rope.' }), people).cameraMove).toBe(false);
});

/** A film shot with the given traits. */
const film = (
  n: number,
  traits: Partial<FilmShot['traits']> = {},
  durationSeconds = 4,
  finished = false,
  sceneId = 'scn_a',
): FilmShot => ({
  id: `sht_${n}`,
  sceneId,
  durationSeconds,
  traits: { people: false, cameraMove: false, ...traits },
  finished,
});

test('a preview picks one shot with people, one camera move and one static shot, the shortest of each', () => {
  const shots = [
    film(1, { people: true }, 8),
    film(2, { cameraMove: true }, 6),
    film(3, {}, 5),
    film(4, { people: true }, 4),
    film(5, { cameraMove: true }, 3),
    film(6, {}, 9),
  ];
  expect(selectPreviewShots(shots).map((s) => s.id)).toEqual(['sht_3', 'sht_4', 'sht_5']);
});

test('a preview skips finished shots, fills missing kinds, and never picks more than exist', () => {
  const shots = [
    film(1, {}, 4),
    film(2, {}, 4),
    film(3, {}, 4, true),
    film(4, {}, 4),
    film(5, {}, 4),
  ];
  const picked = selectPreviewShots(shots);
  expect(picked).toHaveLength(3);
  expect(picked.map((s) => s.id)).not.toContain('sht_3');
  expect(new Set(picked.map((s) => s.id)).size).toBe(3);
  expect(selectPreviewShots([film(1), film(2)], 5)).toHaveLength(2);
  expect(selectPreviewShots([])).toEqual([]);
});

test('shots are listed in film order with their traits, and scopes select by film, scene or shot', () => {
  const f = buildSampleFilm();
  const [scene] = f.scenes;
  if (!scene) throw new Error('sample data changed');
  const shots = filmShots(
    [scene, { ...scene, id: sampleId('scn', 2), number: 2, shots: [shot(2), shot(3)] }],
    new Set([sampleId('chr', 1)]),
    new Set([sampleId('sht', 3)]),
  );
  expect(shots.map((s) => [s.id, s.finished])).toEqual([
    [sampleId('sht', 1), false],
    [sampleId('sht', 2), false],
    [sampleId('sht', 3), true],
  ]);
  expect(shotsInScope(shots, { kind: 'all' })).toHaveLength(3);
  expect(shotsInScope(shots, { kind: 'scenes', sceneIds: [sampleId('scn', 2)] })).toHaveLength(2);
  expect(shotsInScope(shots, { kind: 'shots', shotIds: [sampleId('sht', 2)] })).toHaveLength(1);
});

/** Four 5 s shots, one already finished. */
const priced = [film(1, {}, 5), film(2, {}, 5), film(3, {}, 5), film(4, {}, 5, true)];
const price = { perVideoSecond: 0.5, currency: 'USD', renderSecondsPerVideoSecond: 40 };

test('before a preview the estimate is a wide range for three figures, and finished shots cost nothing', () => {
  const e = estimateFinishing(priced, new Set(['sht_1']), price);
  expect(e.selected).toMatchObject({
    shots: 1,
    videoSeconds: 5,
    basis: 'untested',
    currency: 'USD',
  });
  expect(e.remaining).toMatchObject({ shots: 2, videoSeconds: 10 });
  expect(e.whole).toMatchObject({ shots: 3, videoSeconds: 15 });
  expect(e.whole.cost.low).toBeCloseTo((15 * 0.5) / UNTESTED_ACCEPT_RANGE.high);
  expect(e.whole.cost.high).toBeCloseTo((15 * 0.5) / UNTESTED_ACCEPT_RANGE.low);
  expect(e.whole.renderSeconds?.low).toBeCloseTo((15 * 40) / UNTESTED_ACCEPT_RANGE.high);
  expect(e.selected.cost.low + e.remaining.cost.low).toBeCloseTo(e.whole.cost.low);
});

test('a local model without a price still gets a time estimate and no cost', () => {
  const e = estimateFinishing(priced, new Set(), {
    perVideoSecond: 0,
    currency: 'USD',
    renderSecondsPerVideoSecond: 40,
  });
  expect(e.whole.cost).toEqual({ low: 0, high: 0 });
  expect(e.whole.renderSeconds?.high).toBeGreaterThan(e.whole.renderSeconds?.low ?? Infinity);
  expect(
    estimateFinishing(priced, new Set(), { perVideoSecond: 1, currency: 'USD' }).whole,
  ).not.toHaveProperty('renderSeconds');
});

test('after a preview the estimate narrows, and a good preview lowers it', () => {
  const untested = estimateFinishing(priced, new Set(), price).whole;
  const good = estimateFinishing(priced, new Set(), price, { attempts: 3, accepted: 3 }).whole;
  const poor = estimateFinishing(priced, new Set(), price, { attempts: 3, accepted: 1 }).whole;
  expect(good.basis).toBe('preview');
  expect(good.cost.high - good.cost.low).toBeLessThan(untested.cost.high - untested.cost.low);
  expect(good.cost.high).toBeLessThan(poor.cost.high);
  expect(acceptRange({ attempts: 20, accepted: 15 })).toSatisfy(
    (r: { low: number; high: number }) =>
      r.high - r.low <
      acceptRange({ attempts: 3, accepted: 2 }).high -
        acceptRange({ attempts: 3, accepted: 2 }).low,
  );
  expect(acceptRange({ attempts: 0, accepted: 0 })).toEqual(UNTESTED_ACCEPT_RANGE);
});
