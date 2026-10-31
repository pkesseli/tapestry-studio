import type { ParsedScene } from './fountain';
import type { Range } from './types';

/** A shot as planned from the script: what it shows, where it sits in the text, and any direction for it. */
export interface PlannedShot {
  /** Stable text key (normalised wording) used to recognise the shot again after the text is edited. */
  key: string;
  /** `action` for an action paragraph, `line` for one spoken line. */
  kind: 'action' | 'line';
  /** What the shot shows: the action paragraph, or `NAME: what is said`. */
  action: string;
  /** Who speaks, for `line` shots. */
  speaker?: string;
  /** What is said, for `line` shots. */
  line?: string;
  /** Where the shot's text sits in the screenplay; the first line is where its margin marker goes. */
  range: Range;
  /** Guidance from `[[direction: ...]]` notes under the shot, joined with a space. */
  direction?: string;
  /** Rough length in seconds, from the amount of text. */
  durationSeconds: number;
}

/** Shortest and longest planned shot, in seconds. */
const MIN_SECONDS = 2;
const MAX_SECONDS = 10;

/**
 * Estimates how long a shot runs from its text.
 * @param text What the shot shows or says.
 * @param wordsPerSecond Reading pace: faster for action, slower for speech.
 */
function seconds(text: string, wordsPerSecond: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(1.5 + words / wordsPerSecond)));
}

/**
 * Plans the shots of a scene from its script: one for every action paragraph and one for every spoken line, in order.
 * A `[[direction: ...]]` note belongs to the shot above it (or the first shot when it comes before any). This is the
 * default; the writer never has to mark shots in the text.
 * @param scene A parsed scene.
 */
export function planShots(scene: ParsedScene): PlannedShot[] {
  const shots: PlannedShot[] = [];
  for (const beat of scene.beats) {
    if (beat.action.trim()) {
      shots.push({
        key: shotKey(beat.action),
        kind: 'action',
        action: beat.action,
        range: beat.actionRange,
        durationSeconds: seconds(beat.action, 3),
      });
    }
    for (const line of beat.dialogue) {
      if (!line.text.trim()) continue;
      const action = `${line.speaker}: ${line.text}`;
      shots.push({
        key: shotKey(action),
        kind: 'line',
        action,
        speaker: line.speaker,
        line: line.text,
        range: line.range,
        durationSeconds: seconds(line.text, 2.5),
      });
    }
  }
  for (const note of scene.notes.filter((n) => n.direction && n.text)) {
    const owner =
      [...shots].reverse().find((shot) => shot.range.start <= note.range.start) ?? shots[0];
    if (owner) owner.direction = owner.direction ? `${owner.direction} ${note.text}` : note.text;
  }
  return shots;
}

/**
 * Lower-cases and collapses whitespace, so small spacing edits do not make a shot look new.
 * @param text Shot wording.
 */
export function shotKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
