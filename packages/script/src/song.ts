import type { SectionKind } from '@tapestry/core';
import { splitLines } from './types';
import type { Diagnostic, Range } from './types';

/** One line of lyrics. */
export interface SongLyric {
  text: string;
  /** Name from the most recent `@` line, if any. */
  singer?: string;
  range: Range;
}

/** What one instrument does in a section, from a `[name: direction]` line. */
export interface SongInstrumentNote {
  name: string;
  nameRange: Range;
  direction: string;
  /** False for `[name: off]` and `[name off]`. */
  enabled: boolean;
  range: Range;
}

/** A section of a song: heading settings, lyrics, singers and instrument notes. */
export interface SongSection {
  name: string;
  nameRange: Range;
  kind: SectionKind;
  bars?: number;
  seconds?: number;
  tempoBpm?: number;
  key?: string;
  singers: { name: string; range: Range }[];
  lyrics: SongLyric[];
  instruments: SongInstrumentNote[];
  range: Range;
}

/** The result of parsing a song outline. */
export interface SongDocument {
  title?: string;
  sections: SongSection[];
  diagnostics: Diagnostic[];
}

/** Words that mean an instrument is silent in a section. */
const SILENT = new Set(['off', 'mute', 'muted', 'silent', 'out', 'tacet']);

/**
 * Guesses the structural role of a section from its name.
 * @param name Section name such as "Verse 2" or "Pre-Chorus".
 */
export function inferSectionKind(name: string): SectionKind {
  const lower = name.toLowerCase();
  if (/^pre[- ]?chorus/.test(lower)) return 'pre-chorus';
  if (/^(verse|stanza)/.test(lower)) return 'verse';
  if (/^(chorus|refrain|hook)/.test(lower)) return 'chorus';
  if (/^bridge/.test(lower)) return 'bridge';
  if (/^intro/.test(lower)) return 'intro';
  if (/^(outro|coda|ending)/.test(lower)) return 'outro';
  if (/^(solo|instrumental|break)/.test(lower)) return 'solo';
  return 'other';
}

/**
 * Applies the comma-separated settings of a section heading such as `8 bars, 90 bpm, Am`.
 * @param section Section to fill in.
 * @param settings Text between the square brackets.
 * @param range Where the settings are, for diagnostics.
 * @param diagnostics Output list for settings that are not understood.
 */
function applySettings(
  section: SongSection,
  settings: string,
  range: Range,
  diagnostics: Diagnostic[],
): void {
  for (const raw of settings.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    let match: RegExpExecArray | null;
    if ((match = /^(\d+)\s*bars?$/i.exec(part))) section.bars = Number(match[1]);
    else if ((match = /^(\d+(?:\.\d+)?)\s*bpm$/i.exec(part))) section.tempoBpm = Number(match[1]);
    else if ((match = /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)$/i.exec(part)))
      section.seconds = Number(match[1]);
    else if (/^[A-G][#b♯♭]?\s*(?:m|min|minor|maj|major)?$/.test(part)) section.key = part;
    else
      diagnostics.push({
        range,
        severity: 'warning',
        message: `Section setting "${part}" is not understood (use e.g. 8 bars, 90 bpm, Am)`,
      });
  }
}

/**
 * Parses a song outline (`*.song.md`):
 *
 *     # Title                      (optional)
 *     ## Verse 1 [8 bars, 90 bpm, Am]
 *     @Lead singer                 (who sings the following lines)
 *     [guitar: fingerpicked]       (instrument direction; "[piano off]" silences it)
 *     The fog rolls in
 *
 * @param source The song text.
 */
export function parseSong(source: string): SongDocument {
  const doc: SongDocument = { sections: [], diagnostics: [] };
  let section: SongSection | undefined;
  let singer: string | undefined;
  for (const line of splitLines(source)) {
    const trimmed = line.text.trim();
    const offset = line.start + line.text.indexOf(trimmed);
    const range: Range = { start: offset, end: offset + trimmed.length };
    if (!trimmed || trimmed.startsWith('//')) continue;
    const title = /^#\s+(.+)$/.exec(trimmed);
    const heading = /^##\s+(.+?)\s*(?:\[([^\]]*)\])?\s*$/.exec(trimmed);
    if (title && !trimmed.startsWith('##')) {
      doc.title = title[1] ?? '';
    } else if (heading) {
      const name = (heading[1] ?? '').trim();
      const nameStart = offset + trimmed.indexOf(name);
      section = {
        name,
        nameRange: { start: nameStart, end: nameStart + name.length },
        kind: inferSectionKind(name),
        singers: [],
        lyrics: [],
        instruments: [],
        range: { ...range },
      };
      singer = undefined;
      if (heading[2] !== undefined) applySettings(section, heading[2], range, doc.diagnostics);
      doc.sections.push(section);
    } else if (!section) {
      doc.diagnostics.push({
        range,
        severity: 'warning',
        message: 'Text before the first "## Section" heading is ignored',
      });
    } else {
      section.range.end = range.end;
      const singerMatch = /^@\s*(.+)$/.exec(trimmed);
      const noteMatch = /^\[(.+)\]$/.exec(trimmed);
      if (singerMatch) {
        singer = (singerMatch[1] ?? '').trim();
        const start = offset + trimmed.indexOf(singer);
        section.singers.push({ name: singer, range: { start, end: start + singer.length } });
      } else if (noteMatch) {
        section.instruments.push(instrumentNote(noteMatch[1] ?? '', offset + 1, range));
      } else {
        section.lyrics.push({ text: trimmed, ...(singer !== undefined && { singer }), range });
      }
    }
  }
  return doc;
}

/**
 * Parses the inside of an instrument line.
 * @param inner Text between the brackets.
 * @param innerStart Offset of the first character of `inner`.
 * @param range Range of the whole line.
 */
function instrumentNote(inner: string, innerStart: number, range: Range): SongInstrumentNote {
  const colon = /^([^:]+):\s*(.*)$/.exec(inner);
  const shorthand = /^(.+?)\s+(\S+)$/.exec(inner);
  let name = inner.trim();
  let direction = '';
  if (colon) {
    name = (colon[1] ?? '').trim();
    direction = (colon[2] ?? '').trim();
  } else if (shorthand && SILENT.has((shorthand[2] ?? '').toLowerCase())) {
    name = (shorthand[1] ?? '').trim();
    direction = (shorthand[2] ?? '').trim();
  }
  const start = innerStart + inner.indexOf(name);
  return {
    name,
    nameRange: { start, end: start + name.length },
    direction,
    enabled: !SILENT.has(direction.toLowerCase()),
    range,
  };
}
