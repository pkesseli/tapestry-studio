import type { EntityKind, Id } from '@tapestry/core';

/** A stretch of the source text, as character offsets (`end` is exclusive). */
export interface Range {
  start: number;
  end: number;
}

/** A line of the source with its position. */
export interface SourceLine {
  /** Text of the line without the line break. */
  text: string;
  /** Offset of the first character in the whole text. */
  start: number;
}

/** Which kind of writing a file contains. */
export type ScriptKind = 'fountain' | 'song';

/** Where in the text a mention was found. */
export type MentionSource = 'scene-heading' | 'character-cue' | 'action' | 'singer' | 'instrument';

/** Whether a mention points at a known entity. */
export type MentionStatus = 'resolved' | 'ambiguous' | 'unresolved';

/** A name in the text that probably refers to a character, place, prop, voice or instrument. */
export interface Mention {
  /** The name as written. */
  text: string;
  range: Range;
  source: MentionSource;
  /** The entity kind this mention is (resolved) or should become (unresolved). */
  kind: EntityKind;
  status: MentionStatus;
  /** Matching entities: one when resolved, several when ambiguous, none when unresolved. */
  entityIds: Id[];
}

/** A problem or hint about the text, shown next to it in the editor. */
export interface Diagnostic {
  range: Range;
  severity: 'warning' | 'info';
  message: string;
}

/** Splits text into lines, remembering where each starts. Handles `\n` and `\r\n`. */
export function splitLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  while (start <= text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline < 0 ? text.length : newline;
    const raw = text.slice(start, end);
    lines.push({ text: raw.endsWith('\r') ? raw.slice(0, -1) : raw, start });
    if (newline < 0) break;
    start = newline + 1;
  }
  return lines;
}
