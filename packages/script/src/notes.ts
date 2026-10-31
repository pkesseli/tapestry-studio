import type { Range } from './types';

/** A `[[note]]` in the screenplay. Notes never appear in the printed script. */
export interface FountainNote {
  /** What the note says; for directions, without the `direction:` prefix. */
  text: string;
  /** The whole `[[...]]`, brackets included. */
  range: Range;
  /**
   * True for `[[direction: ...]]`: guidance for how the shot looks (camera, mood, light) that is sent to the video
   * model. Plain notes are private reminders and are never sent anywhere.
   */
  direction: boolean;
}

/** The marker that turns a note into a direction. */
const DIRECTION_PREFIX = /^\s*(?:direction|dir)\s*:\s*/i;

/**
 * Finds the notes of a screenplay, skipping anything inside `/* ... *\/` boneyard.
 * @param source The screenplay text.
 */
export function extractNotes(source: string): FountainNote[] {
  const hidden: Range[] = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
  const notes: FountainNote[] = [];
  for (const match of source.matchAll(/\[\[([\s\S]*?)\]\]/g)) {
    const start = match.index;
    if (hidden.some((range) => start >= range.start && start < range.end)) continue;
    const inner = match[1] ?? '';
    const direction = DIRECTION_PREFIX.test(inner);
    notes.push({
      text: (direction ? inner.replace(DIRECTION_PREFIX, '') : inner).trim(),
      range: { start, end: start + match[0].length },
      direction,
    });
  }
  return notes;
}

/**
 * Text that inserts a direction note. The editor uses it so nobody has to type the syntax.
 * @param text What the direction says; may be empty.
 */
export function directionNote(text = ''): string {
  return `[[direction: ${text}]]`;
}
