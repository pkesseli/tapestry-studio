import { summarizeRuns } from './runs.mjs';

/** What plan 10 asks for before it can be closed: how many candidates of each kind must have run at least once. */
export const REQUIRED_KINDS = { video: 3, image: 1, speech: 1, music: 1 };

/**
 * Formats seconds for a table cell.
 * @param {number | null} seconds Seconds, or `null`.
 * @returns {string} For example "95 s" or "12 min"; "-" when unknown.
 */
export function formatDuration(seconds) {
  if (seconds === null) return '-';
  return seconds < 120 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`;
}

/**
 * Escapes text for a Markdown table cell.
 * @param {string | undefined} text Text.
 * @returns {string} The text without line breaks or pipes.
 */
function cell(text) {
  return (text ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/');
}

/**
 * Decides the "does it run" column: a human verdict in the findings wins, otherwise the runs decide.
 * @param {ReturnType<typeof summarizeRuns>} summary The candidate's runs.
 * @param {{ runs?: string } | undefined} finding What the human wrote about the candidate.
 * @returns {string} "yes", "partly", "no" or "not tried".
 */
function runsVerdict(summary, finding) {
  if (finding?.runs) return finding.runs;
  if (summary.runs === 0) return 'not tried';
  return summary.ok > 0 ? 'yes' : 'no';
}

/**
 * Builds the results document that plan 10 and plan 10b ask for, from the raw run log and the hand-written findings.
 * @param {object} input Everything known.
 * @param {Record<string, any> | null} input.system The machine (`system.json`).
 * @param {Record<string, any>[]} input.candidates The candidate list (`candidates.json`).
 * @param {Record<string, any>[]} input.runs All logged runs.
 * @param {Record<string, any>} input.findings Hand-written notes per candidate id.
 * @returns {string} Markdown.
 */
export function renderReport({ system, candidates, runs, findings }) {
  const lines = ['# Measured on this machine', ''];
  if (system) {
    lines.push(
      `${system.chip ?? 'unknown chip'}, ${system.gpuCores ?? '?'} GPU cores, ${system.memoryGiB ?? '?'} GB memory, ` +
        `macOS ${system.macOS ?? '?'} (recorded ${String(system.capturedAt).slice(0, 10)}).`,
      '',
    );
  } else {
    lines.push('Machine not recorded: run `node spikes/system-info.mjs`.', '');
  }
  lines.push(
    '| Candidate | Kind | Runs? | Ok / runs | Median time | Peak memory | Notes |',
    '|---|---|---|---|---|---|---|',
  );
  const verdicts = new Map();
  for (const candidate of candidates) {
    const own = runs.filter((run) => run.candidate === candidate.id);
    const summary = summarizeRuns(own);
    const finding = findings[candidate.id];
    const verdict = runsVerdict(summary, finding);
    verdicts.set(candidate.id, verdict);
    const notes = [finding?.blockers, finding?.quality, finding?.notes].filter(Boolean).join(' ');
    const trouble = [
      summary.timedOut ? `${summary.timedOut} timed out` : '',
      summary.failed ? `${summary.failed} failed` : '',
      summary.noOutput ? `${summary.noOutput} without output` : '',
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(
      `| ${cell(candidate.name)} | ${candidate.kind} | ${verdict} | ${summary.ok} / ${summary.runs} | ` +
        `${formatDuration(summary.medianSeconds)} | ${summary.peakGiB === null ? '-' : `${summary.peakGiB.toFixed(1)} GB`} | ` +
        `${cell([trouble, notes].filter(Boolean).join('; '))} |`,
    );
  }
  lines.push('', '## Plan 10 acceptance', '');
  for (const [kind, needed] of Object.entries(REQUIRED_KINDS)) {
    const worked = candidates.filter(
      (c) => c.kind === kind && ['yes', 'partly'].includes(verdicts.get(c.id)),
    ).length;
    lines.push(
      `- ${kind}: ${worked} of ${needed} needed ran ${worked >= needed ? '(met)' : '(NOT met)'}`,
    );
  }
  if (typeof findings.summary === 'string' && findings.summary.trim()) {
    lines.push('', '## Recommended local defaults', '', findings.summary.trim());
  }
  return `${lines.join('\n')}\n`;
}
