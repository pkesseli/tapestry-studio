import { splitLines } from './types';
import type { Range, SourceLine } from './types';

/** One element of a screenplay, in document order. Text elements keep their exact source text and range. */
export type FountainElement =
  | { type: 'title-page'; entries: { key: string; value: string }[]; range: Range }
  | {
      type: 'scene-heading';
      text: string;
      range: Range;
      sceneNumber?: string;
      locationName: string;
      /** Where `locationName` sits inside the text, for underlining. */
      locationRange: Range;
      timeOfDay?: string;
    }
  | { type: 'action'; text: string; range: Range }
  | { type: 'character'; name: string; nameRange: Range; extension?: string; range: Range }
  | { type: 'dialogue'; text: string; range: Range }
  | { type: 'parenthetical'; text: string; range: Range }
  | { type: 'transition'; text: string; range: Range }
  | { type: 'lyric'; text: string; range: Range }
  | { type: 'centered'; text: string; range: Range }
  | { type: 'section' | 'synopsis' | 'page-break'; text: string; range: Range };

/** One spoken line of a beat. */
export interface BeatDialogue {
  speaker: string;
  text: string;
  parenthetical?: string;
  range: Range;
}

/** A paragraph of action together with the dialogue that follows it; the raw material for shots (plan 08). */
export interface Beat {
  action: string;
  dialogue: BeatDialogue[];
  range: Range;
}

/** A scene: its heading, everything up to the next heading, and the beats within. */
export interface ParsedScene {
  heading: Extract<FountainElement, { type: 'scene-heading' }>;
  elements: FountainElement[];
  beats: Beat[];
}

/** The result of parsing a screenplay. */
export interface FountainDocument {
  elements: FountainElement[];
  /** Elements before the first scene heading (title page, opening notes). */
  preamble: FountainElement[];
  scenes: ParsedScene[];
}

/** Words that mark the time of day at the end of a scene heading. */
const TIME_WORDS =
  /^(day|night|morning|afternoon|evening|dawn|dusk|sunrise|sunset|noon|midnight|later|continuous|moments later|same|same time|day\s*\/\s*night)$/i;

/** Scene heading starts: INT, EXT, EST, INT./EXT., I/E followed by a dot or space. */
const HEADING_START = /^(?:int\.?\/ext|ext\.?\/int|int|ext|est|i\/e)(?:\.|\s)/i;

/** Blanks out `/* ... *\/` boneyard and `[[ ... ]]` notes, keeping line breaks so offsets stay valid. */
function stripHidden(text: string): string {
  const blank = (match: string): string => match.replace(/[^\r\n]/g, ' ');
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\[\[[\s\S]*?\]\]/g, blank);
}

/**
 * Tells whether a line is blank.
 * @param line Line to test.
 */
const isBlank = (line: SourceLine | undefined): boolean =>
  line === undefined || line.text.trim() === '';

/**
 * Tells whether a name is written in capitals (it must contain at least one letter).
 * @param name Name without any parenthetical extension.
 */
function isUpperCase(name: string): boolean {
  return /\p{L}/u.test(name) && name === name.toUpperCase() && name !== name.toLowerCase();
}

/**
 * Parses a screenplay in Fountain format (see https://fountain.io/syntax; implemented independently from the
 * specification). Handles title page, scene headings with numbers, action, characters with extensions, dialogue,
 * parentheticals, transitions, lyrics, centered text, sections, synopses, page breaks, notes and boneyard, and the
 * `.` `!` `@` `>` `~` forcing characters.
 * @param source The screenplay text.
 */
export function parseFountain(source: string): FountainDocument {
  const text = stripHidden(source);
  const lines = splitLines(text);
  const elements: FountainElement[] = [];
  let i = 0;

  const first = lines[0]?.text ?? '';
  if (/^[A-Za-z][A-Za-z ]*:/.test(first)) {
    const entries: { key: string; value: string }[] = [];
    const startLine = lines[0] as SourceLine;
    while (i < lines.length && !isBlank(lines[i])) {
      const line = lines[i] as SourceLine;
      const match = /^([A-Za-z][A-Za-z ]*):\s*(.*)$/.exec(line.text);
      if (match) entries.push({ key: (match[1] ?? '').trim(), value: match[2] ?? '' });
      else if (entries.length > 0 && /^\s/.test(line.text)) {
        const last = entries[entries.length - 1];
        if (last) last.value = `${last.value}\n${line.text.trim()}`.trim();
      }
      i++;
    }
    const end = lines[i - 1] as SourceLine;
    elements.push({
      type: 'title-page',
      entries,
      range: { start: startLine.start, end: end.start + end.text.length },
    });
  }

  for (; i < lines.length; i++) {
    const line = lines[i] as SourceLine;
    if (isBlank(line)) continue;
    const range = (from: SourceLine, to: SourceLine = from, offset = 0): Range => ({
      start: from.start + offset,
      end: to.start + to.text.length,
    });
    const trimmed = line.text.trim();
    const previousBlank = i === 0 || isBlank(lines[i - 1]);
    const nextBlank = isBlank(lines[i + 1]);

    if (trimmed === '===') elements.push({ type: 'page-break', text: trimmed, range: range(line) });
    else if (trimmed.startsWith('#'))
      elements.push({ type: 'section', text: trimmed.replace(/^#+\s*/, ''), range: range(line) });
    else if (trimmed.startsWith('='))
      elements.push({ type: 'synopsis', text: trimmed.replace(/^=\s*/, ''), range: range(line) });
    else if (/^>.*<$/.test(trimmed))
      elements.push({ type: 'centered', text: trimmed.slice(1, -1).trim(), range: range(line) });
    else if (trimmed.startsWith('~'))
      elements.push({ type: 'lyric', text: trimmed.slice(1).trim(), range: range(line) });
    else if (previousBlank && (/^\.(?!\.)/.test(trimmed) || HEADING_START.test(trimmed))) {
      elements.push(headingElement(line, trimmed.startsWith('.')));
    } else if (trimmed.startsWith('>')) {
      elements.push({ type: 'transition', text: trimmed.slice(1).trim(), range: range(line) });
    } else if (previousBlank && nextBlank && isUpperCase(trimmed) && /TO:$/.test(trimmed)) {
      elements.push({ type: 'transition', text: trimmed, range: range(line) });
    } else if (previousBlank && !nextBlank && isCharacterCue(trimmed)) {
      i = readDialogue(lines, i, elements);
    } else if (trimmed.startsWith('!')) {
      const offset = line.text.indexOf('!') + 1;
      const forcedText = line.text.slice(offset).trimEnd();
      elements.push({
        type: 'action',
        text: forcedText,
        range: { start: line.start + offset, end: line.start + offset + forcedText.length },
      });
    } else {
      let end = i;
      while (end + 1 < lines.length && !isBlank(lines[end + 1])) end++;
      const last = lines[end] as SourceLine;
      const raw = text.slice(line.start, last.start + last.text.length).trimEnd();
      elements.push({
        type: 'action',
        text: raw,
        range: { start: line.start, end: line.start + raw.length },
      });
      i = end;
    }
  }
  return group(elements);
}

/**
 * Tells whether a trimmed line is a character cue.
 * @param trimmed The line without surrounding spaces.
 */
function isCharacterCue(trimmed: string): boolean {
  if (trimmed.startsWith('@')) return trimmed.length > 1;
  const name = trimmed.replace(/\s*\^$/, '').replace(/\s*\([^)]*\)$/, '');
  return isUpperCase(name) && !HEADING_START.test(trimmed) && !trimmed.startsWith('!');
}

/**
 * Builds a scene-heading element, splitting location and time of day.
 * @param line The heading line.
 * @param forced True for headings forced with a leading dot.
 */
function headingElement(
  line: SourceLine,
  forced: boolean,
): Extract<FountainElement, { type: 'scene-heading' }> {
  const leading = line.text.length - line.text.trimStart().length;
  const skip = forced ? 1 : 0;
  const text = line.text.trim().slice(skip);
  const textStart = line.start + leading + skip;
  const numberMatch = /\s#([^#]+)#\s*$/.exec(text);
  const core = numberMatch ? text.slice(0, numberMatch.index).trim() : text;
  const prefix = forced
    ? undefined
    : /^(?:int\.?\/ext|ext\.?\/int|int|ext|est|i\/e)[.\s]+/i.exec(core);
  const prefixLength = prefix ? prefix[0].length : 0;
  const parts = core.slice(prefixLength).split(/\s+[-–—]\s+/);
  const times: string[] = [];
  while (parts.length > 1 && TIME_WORDS.test(parts[parts.length - 1]?.trim() ?? '')) {
    times.unshift((parts.pop() ?? '').trim());
  }
  const locationName = parts.join(' - ').trim();
  const nameOffset = locationName ? core.indexOf(locationName, prefixLength) : prefixLength;
  const nameStart = textStart + Math.max(nameOffset, 0);
  return {
    type: 'scene-heading',
    text,
    range: { start: textStart, end: textStart + text.length },
    ...(numberMatch?.[1] !== undefined && { sceneNumber: numberMatch[1].trim() }),
    locationName,
    locationRange: { start: nameStart, end: nameStart + locationName.length },
    ...(times.length > 0 && { timeOfDay: times.join(' - ') }),
  };
}

/**
 * Reads a character cue and its dialogue block, adding the elements.
 * @param lines All lines.
 * @param index Index of the cue line.
 * @param elements Output list.
 * @returns Index of the last line consumed.
 */
function readDialogue(lines: SourceLine[], index: number, elements: FountainElement[]): number {
  const cue = lines[index] as SourceLine;
  const forced = cue.text.trim().startsWith('@');
  const raw = cue.text
    .trim()
    .replace(/\s*\^$/, '')
    .replace(/^@/, '');
  const extensionMatch = /\s*\(([^)]*)\)$/.exec(raw);
  const name = (extensionMatch ? raw.slice(0, extensionMatch.index) : raw).trim();
  const nameStart = cue.start + cue.text.indexOf(name, forced ? cue.text.indexOf('@') + 1 : 0);
  elements.push({
    type: 'character',
    name,
    nameRange: { start: nameStart, end: nameStart + name.length },
    ...(extensionMatch?.[1] !== undefined && { extension: extensionMatch[1] }),
    range: { start: cue.start, end: cue.start + cue.text.length },
  });
  let i = index + 1;
  while (i < lines.length && !isBlank(lines[i])) {
    const line = lines[i] as SourceLine;
    const trimmed = line.text.trim();
    const type = /^\(.*\)$/.test(trimmed) ? 'parenthetical' : 'dialogue';
    elements.push({
      type,
      text: trimmed,
      range: {
        start: line.start + line.text.indexOf(trimmed),
        end: line.start + line.text.indexOf(trimmed) + trimmed.length,
      },
    });
    i++;
  }
  return i - 1;
}

/**
 * Groups elements into scenes and beats.
 * @param elements All elements in document order.
 */
function group(elements: FountainElement[]): FountainDocument {
  const preamble: FountainElement[] = [];
  const scenes: ParsedScene[] = [];
  for (const element of elements) {
    if (element.type === 'scene-heading')
      scenes.push({ heading: element, elements: [], beats: [] });
    else (scenes[scenes.length - 1]?.elements ?? preamble).push(element);
  }
  for (const scene of scenes) scene.beats = beatsOf(scene.elements);
  return { elements, preamble, scenes };
}

/**
 * Splits a scene's elements into beats: each action paragraph plus the dialogue that follows it.
 * @param elements Elements of one scene.
 */
function beatsOf(elements: FountainElement[]): Beat[] {
  const beats: Beat[] = [];
  let current: Beat | undefined;
  let open: BeatDialogue | undefined;
  for (const element of elements) {
    if (element.type === 'action') {
      current = { action: element.text, dialogue: [], range: { ...element.range } };
      beats.push(current);
      open = undefined;
    } else if (element.type === 'character') {
      if (!current) {
        current = { action: '', dialogue: [], range: { ...element.range } };
        beats.push(current);
      }
      open = { speaker: element.name, text: '', range: { ...element.range } };
      current.dialogue.push(open);
      current.range.end = element.range.end;
    } else if (open && current && element.type === 'parenthetical') {
      open.parenthetical = open.parenthetical
        ? `${open.parenthetical} ${element.text}`
        : element.text;
      open.range.end = current.range.end = element.range.end;
    } else if (open && current && element.type === 'dialogue') {
      open.text = open.text ? `${open.text} ${element.text}` : element.text;
      open.range.end = current.range.end = element.range.end;
    }
  }
  return beats;
}
