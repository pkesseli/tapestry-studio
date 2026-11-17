import type { Job, GenerationRequest } from './schema/jobs';
import type { Scene, Shot } from './schema/units';

/**
 * Drafts and finals (plan 09b). A draft is a cheap render a person approves; the final is a fresh render at the quality
 * that goes into the film, with the draft's prompt, references and seed, so it keeps the draft's framing and movement.
 * Everything here is pure: no files, no providers, nothing that needs a GPU.
 */

/** The request for the final of an approved draft, or the reason there cannot be one. */
export type FinalRequestResult =
  { ok: true; request: GenerationRequest; sourceJobId: Job['id'] } | { ok: false; reason: string };

/**
 * Builds the request for the final that follows an accepted draft. It keeps what makes the final look like the draft
 * (prompt, negative prompt, references, audio inputs, duration, frame rate, provider and above all the seed) and drops
 * what belongs to the draft tier (size and provider-specific settings), which the provider chooses again for `final`.
 * @param draft The draft job.
 * @returns The request and the id to store as the final job's `sourceJobId`, or the reason it cannot be made: only an
 * accepted job made at `draft` quality with a seed can be followed.
 */
export function finalRequestFromDraft(draft: Job): FinalRequestResult {
  if (draft.request.quality !== 'draft') return { ok: false, reason: 'This job is not a draft' };
  if (draft.state !== 'accepted')
    return { ok: false, reason: 'The draft has not been accepted yet' };
  const { width: _width, height: _height, extras: _extras, ...kept } = draft.request;
  if (kept.seed === undefined) {
    return { ok: false, reason: 'The draft has no seed, so a final cannot follow its framing' };
  }
  return { ok: true, request: { ...kept, quality: 'final', extras: {} }, sourceJobId: draft.id };
}

/** What kind of shot it is, as far as choosing a representative preview goes. */
export interface ShotTraits {
  /** A character appears or speaks. */
  people: boolean;
  /** The camera moves (push, pan, track...), as written in the camera hint or the direction. */
  cameraMove: boolean;
}

/** Words that mean the camera moves; "locked-off" and "static" are not among them. */
const CAMERA_MOVES =
  /\b(push|pull|pan|tilt|track(?:ing)?|dolly|zoom|crane|drift|rising|follow(?:s|ing)?|orbit|handheld|whip)\b/i;

/**
 * Describes a shot from its script data.
 * @param shot The shot.
 * @param personIds Ids of the entities that are people (characters).
 */
export function classifyShot(shot: Shot, personIds: ReadonlySet<string>): ShotTraits {
  return {
    people: shot.dialogue.length > 0 || shot.referenceEntityIds.some((id) => personIds.has(id)),
    cameraMove: CAMERA_MOVES.test(`${shot.cameraHint ?? ''} ${shot.direction ?? ''}`),
  };
}

/** A shot as the preview selection and the estimate see it. */
export interface FilmShot {
  id: string;
  sceneId: string;
  durationSeconds: number;
  traits: ShotTraits;
  /** An accepted final already exists, so the shot needs no more spending. */
  finished: boolean;
}

/**
 * Lists the shots of a film in script order, ready for selection and estimates.
 * @param scenes The scenes, in film order.
 * @param personIds Ids of the entities that are people.
 * @param finishedShotIds Shots that already have an accepted final.
 */
export function filmShots(
  scenes: readonly Scene[],
  personIds: ReadonlySet<string>,
  finishedShotIds: ReadonlySet<string> = new Set(),
): FilmShot[] {
  return [...scenes]
    .sort((a, b) => a.number - b.number)
    .flatMap((scene) =>
      scene.shots.map((shot) => ({
        id: shot.id,
        sceneId: scene.id,
        durationSeconds: shot.durationSeconds,
        traits: classifyShot(shot, personIds),
        finished: finishedShotIds.has(shot.id),
      })),
    );
}

/** The kinds of shot a preview tries to cover, in the order they are looked for. */
const PREVIEW_KINDS: readonly ((traits: ShotTraits) => boolean)[] = [
  (t) => t.people,
  (t) => t.cameraMove && !t.people,
  (t) => !t.people && !t.cameraMove,
];

/**
 * Picks the shots for a preview, the cheap way to see what the final quality will look like before committing the
 * whole film: one with people, one with a camera move and one static shot, the shortest of each so the spend stays
 * small. When a kind is missing, or more shots are wanted, it adds evenly spread shots. Finished shots are skipped.
 * @param shots Every shot of the film, in script order.
 * @param count How many shots to pick (default 3).
 * @returns The picked shots, in script order.
 */
export function selectPreviewShots(shots: readonly FilmShot[], count = 3): FilmShot[] {
  const open = shots.filter((shot) => !shot.finished);
  const picked = new Set<FilmShot>();
  for (const kind of PREVIEW_KINDS) {
    if (picked.size >= count) break;
    const best = open
      .filter((shot) => kind(shot.traits) && !picked.has(shot))
      .reduce<FilmShot | undefined>(
        (low, shot) => (!low || shot.durationSeconds < low.durationSeconds ? shot : low),
        undefined,
      );
    if (best) picked.add(best);
  }
  const rest = open.filter((shot) => !picked.has(shot));
  for (let i = 0; picked.size < count && i < rest.length; i++) {
    picked.add(
      rest[Math.floor(((i + 0.5) * rest.length) / Math.max(1, count - picked.size))] ?? rest[i]!,
    );
  }
  return open.filter((shot) => picked.has(shot));
}

/** A choice of shots: the whole film, some scenes, or some shots. */
export type Scope =
  | { kind: 'all' }
  | { kind: 'scenes'; sceneIds: readonly string[] }
  | { kind: 'shots'; shotIds: readonly string[] };

/**
 * The shots a scope selects.
 * @param shots Every shot of the film, in script order.
 * @param scope What was chosen.
 */
export function shotsInScope(shots: readonly FilmShot[], scope: Scope): FilmShot[] {
  if (scope.kind === 'all') return [...shots];
  if (scope.kind === 'scenes') return shots.filter((shot) => scope.sceneIds.includes(shot.sceneId));
  return shots.filter((shot) => scope.shotIds.includes(shot.id));
}

/** What the final quality costs. Editable by the user and flagged as an estimate wherever it is shown. */
export interface PriceEntry {
  /** Money per second of finished video, in `currency`; 0 for a local model. */
  perVideoSecond: number;
  currency: string;
  /** Time to make one second of video, for models whose waiting time matters (a local model). */
  renderSecondsPerVideoSecond?: number;
}

/** How many of the final renders a person is expected to accept, as a share between 0 and 1. */
export interface AcceptRange {
  low: number;
  high: number;
}

/** Before any preview: the share of final renders accepted is a guess, wide on purpose. UNVERIFIED. */
export const UNTESTED_ACCEPT_RANGE: AcceptRange = { low: 0.35, high: 0.8 };

/** Pretend previews seen before the real ones (an accepted and a rejected), so one lucky render does not mean 100%. */
const PRIOR_ACCEPTED = 2;
const PRIOR_REJECTED = 2;

/** The result of a preview: how many finals were rendered and how many were accepted. */
export interface PreviewOutcome {
  attempts: number;
  accepted: number;
}

/**
 * The expected share of accepted final renders. Without a preview it is the wide guess; with one it is the smoothed
 * share of accepted previews with a band that narrows as more previews are rendered.
 * @param preview The preview result, if there is one.
 */
export function acceptRange(preview?: PreviewOutcome): AcceptRange {
  if (!preview || preview.attempts <= 0) return UNTESTED_ACCEPT_RANGE;
  const total = preview.attempts + PRIOR_ACCEPTED + PRIOR_REJECTED;
  const rate = (Math.min(preview.accepted, preview.attempts) + PRIOR_ACCEPTED) / total;
  const band = Math.sqrt((rate * (1 - rate)) / total);
  return { low: Math.max(0.05, rate - band), high: Math.min(1, rate + band) };
}

/** A low and a high figure. */
export interface Range {
  low: number;
  high: number;
}

/** What finishing a set of shots will cost and how long it takes. */
export interface FinishingEstimate {
  /** Shots that still need a final. */
  shots: number;
  /** Length of those shots together. */
  videoSeconds: number;
  /** Money, including the expected extra renders for rejected takes. */
  cost: Range;
  /** Waiting time in seconds, when the price entry says how long a video second takes. */
  renderSeconds?: Range;
  currency: string;
  /** `untested` until a preview exists; the range is then a wide guess. */
  basis: 'untested' | 'preview';
}

/** The three figures a creator needs side by side. */
export interface FinishingEstimates {
  selected: FinishingEstimate;
  remaining: FinishingEstimate;
  whole: FinishingEstimate;
}

/**
 * Estimates the cost of finishing: for the chosen shots, for the rest, and for the whole film. A shot with an accepted
 * final costs nothing more. Each shot is expected to need `1 / accepted share` renders, so the range comes from the
 * accepted share (a wide guess before a preview, narrower after).
 * @param shots Every shot of the film.
 * @param selectedIds Ids of the shots chosen for the expensive pass.
 * @param price What the final quality costs.
 * @param preview Result of a preview, if one was made.
 */
export function estimateFinishing(
  shots: readonly FilmShot[],
  selectedIds: ReadonlySet<string>,
  price: PriceEntry,
  preview?: PreviewOutcome,
): FinishingEstimates {
  const accept = acceptRange(preview);
  const basis = preview && preview.attempts > 0 ? 'preview' : 'untested';
  const of = (chosen: readonly FilmShot[]): FinishingEstimate => {
    const open = chosen.filter((shot) => !shot.finished);
    const videoSeconds = open.reduce((sum, shot) => sum + shot.durationSeconds, 0);
    const range = (unit: number): Range => ({
      low: (videoSeconds * unit) / accept.high,
      high: (videoSeconds * unit) / accept.low,
    });
    return {
      shots: open.length,
      videoSeconds,
      cost: range(price.perVideoSecond),
      ...(price.renderSecondsPerVideoSecond !== undefined && {
        renderSeconds: range(price.renderSecondsPerVideoSecond),
      }),
      currency: price.currency,
      basis,
    };
  };
  return {
    selected: of(shots.filter((shot) => selectedIds.has(shot.id))),
    remaining: of(shots.filter((shot) => !selectedIds.has(shot.id))),
    whole: of(shots),
  };
}
