import { median } from './runs.mjs';

/**
 * Thresholds of the decision rule in `doc/plan/10b-draft-final-spike.md`. They are proposals until the human confirms
 * them, so they live here in one place.
 */
export const RULE = {
  /** Lowest score (of 5) that counts as "kept" for composition, motion and identity. */
  keptScore: 4,
  /** Shots (of the ten) that must have at least one final that kept everything. */
  shotsNeeded: 8,
  /** Longest acceptable time to make one final locally, in seconds. */
  maxFinalSeconds: 600,
  /** Lowest median score (of 5) for "can a person judge the shot from the draft". */
  draftLegibleScore: 4,
};

/** Questions that decide whether a final "kept" the draft. */
const KEPT = ['composition', 'motion', 'identity'];

/** Questions about a draft. */
const DRAFT_KEYS = ['happening', 'acting', 'framing'];

/**
 * The median of a list, or `null` when it is empty.
 * @param {number[]} values Numbers.
 */
function med(values) {
  return values.length ? median(values) : null;
}

/**
 * Collects the answers to one question for one clip from every rater.
 * @param {Record<string, any>[]} raters Ratings files.
 * @param {string} clipId Clip.
 * @param {string} key Question.
 * @returns {number[]} The numeric answers given.
 */
function answers(raters, clipId, key) {
  return raters.flatMap((r) => {
    const value = r.clips?.[clipId]?.[key];
    return typeof value === 'number' ? [value] : [];
  });
}

/**
 * Works out, per way of making finals and per kind of draft, what the ratings and measurements say, and applies the
 * decision rule of plan 10b.
 * @param {object} input What was collected.
 * @param {{ clips: Record<string, any>[] }} input.manifest The clips.
 * @param {Record<string, Record<string, any>>} input.measures Automatic measurements by clip id.
 * @param {Record<string, any>[]} input.raters One ratings file per person.
 * @param {string[]} input.shots The ids of the ten test shots.
 */
export function summarize({ manifest, measures, raters, shots }) {
  const finals = manifest.clips.filter((c) => c.role === 'final');
  const drafts = manifest.clips.filter((c) => c.role === 'draft');
  const variants = {};
  for (const variant of [...new Set(finals.map((c) => c.variant ?? 'unknown'))].sort()) {
    const own = finals.filter((c) => (c.variant ?? 'unknown') === variant);
    const kept = (clip) =>
      KEPT.every((key) => {
        const scores = answers(raters, clip.id, key);
        return scores.length > 0 && median(scores) >= RULE.keptScore;
      });
    const passing = shots.filter((shot) => own.some((c) => c.shot === shot && kept(c)));
    variants[variant] = {
      clips: own.length,
      shotsWithClips: new Set(own.map((c) => c.shot)).size,
      shotsPassing: passing.length,
      medianSeconds: med(own.map((c) => c.seconds).filter((s) => typeof s === 'number')),
      usableYes: own.filter((c) => raters.some((r) => r.clips?.[c.id]?.usable === 'yes')).length,
      scores: Object.fromEntries(
        [...KEPT, 'smooth'].map((key) => [
          key,
          med(own.flatMap((c) => answers(raters, c.id, key))),
        ]),
      ),
      ssimToDraft: med(
        own.map((c) => measures[c.id]?.ssimToDraft).filter((v) => typeof v === 'number'),
      ),
      motionCorrelation: med(
        own
          .map((c) => measures[c.id]?.motionCorrelationToDraft)
          .filter((v) => typeof v === 'number'),
      ),
      passes: passing.length >= RULE.shotsNeeded,
    };
  }
  const draftVariants = {};
  for (const variant of [...new Set(drafts.map((c) => c.variant ?? 'unknown'))].sort()) {
    const own = drafts.filter((c) => (c.variant ?? 'unknown') === variant);
    draftVariants[variant] = Object.fromEntries(
      DRAFT_KEYS.map((key) => [key, med(own.flatMap((c) => answers(raters, c.id, key)))]),
    );
  }
  const fast = (v) => v.medianSeconds !== null && v.medianSeconds <= RULE.maxFinalSeconds;
  const adopted = Object.entries(variants)
    .filter(([, v]) => v.passes && fast(v))
    .map(([name]) => name);
  const legible = Object.entries(draftVariants)
    .filter(([, scores]) =>
      DRAFT_KEYS.every((key) => scores[key] !== null && scores[key] >= RULE.draftLegibleScore),
    )
    .map(([name]) => name);
  return { variants, drafts: draftVariants, adopted, legible, raters: raters.length };
}

/**
 * Formats a number for a table cell.
 * @param {number | null} value Number.
 * @param {number} [digits] Decimals.
 */
function fmt(value, digits = 1) {
  return value === null || value === undefined ? '-' : value.toFixed(digits);
}

/**
 * Writes the summary as Markdown.
 * @param {ReturnType<typeof summarize>} result The computed summary.
 * @returns {string} Markdown.
 */
export function renderSummary(result) {
  const lines = [
    '# Draft and final: summary',
    '',
    `Ratings from ${result.raters} person(s). Scores are medians out of 5. Thresholds are the proposals in plan 10b: a shot`,
    `passes for a way of making finals if one of its finals scored at least ${RULE.keptScore} on composition, motion and`,
    `identity; the way passes with ${RULE.shotsNeeded} of 10 shots and a median of at most ${RULE.maxFinalSeconds / 60} minutes per final.`,
    '',
    '## Finals by way of making them',
    '',
    '| Variant | Finals | Shots passing | Median time | Composition | Motion | Identity | Smooth | SSIM to draft | Motion match | Passes |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const [name, v] of Object.entries(result.variants)) {
    lines.push(
      `| ${name} | ${v.clips} | ${v.shotsPassing} / ${v.shotsWithClips} | ${v.medianSeconds === null ? '-' : `${Math.round(v.medianSeconds / 60)} min`} | ` +
        `${fmt(v.scores.composition)} | ${fmt(v.scores.motion)} | ${fmt(v.scores.identity)} | ${fmt(v.scores.smooth)} | ` +
        `${fmt(v.ssimToDraft, 2)} | ${fmt(v.motionCorrelation, 2)} | ${v.passes ? 'yes' : 'no'} |`,
    );
  }
  lines.push(
    '',
    '## Can a person judge the shot from the draft?',
    '',
    '| Draft | Happening | Acting and mood | Framing |',
    '|---|---|---|---|',
  );
  for (const [name, s] of Object.entries(result.drafts)) {
    lines.push(`| ${name} | ${fmt(s.happening)} | ${fmt(s.acting)} | ${fmt(s.framing)} |`);
  }
  lines.push(
    '',
    '## Verdict by the proposed rule',
    '',
    result.adopted.length
      ? `Staged model viable with: ${result.adopted.join(', ')}.`
      : 'No way of making finals meets the rule: keep "render once, enhance later" (plan 17 narrowed to upscaling).',
    result.legible.length
      ? `Drafts a person can judge: ${result.legible.join(', ')}.`
      : 'No kind of draft was judged legible enough.',
    '',
    'The thresholds are proposals: the human confirms or changes them before this decides anything.',
    '',
  );
  return lines.join('\n');
}
