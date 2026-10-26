import { AliasIndex, normalizeAlias } from '@tapestry/core';
import type { Entity, EntityKind } from '@tapestry/core';
import type { FountainDocument } from './fountain';
import type { SongDocument } from './song';
import type { Mention, MentionSource, Range } from './types';

/** Capitalised words in action lines that are not names. Extend through {@link DetectOptions.stopWords}. */
export const DEFAULT_STOP_WORDS: ReadonlySet<string> = new Set([
  'THE',
  'AND',
  'BUT',
  'FOR',
  'WITH',
  'FROM',
  'INTO',
  'OVER',
  'CUT',
  'FADE',
  'DISSOLVE',
  'SMASH',
  'INSERT',
  'POV',
  'ANGLE',
  'CLOSE',
  'WIDE',
  'BLACK',
  'BACK',
  'CONTINUOUS',
  'LATER',
  'SUDDENLY',
  'DAY',
  'NIGHT',
  'MORNING',
  'EVENING',
  'INT',
  'EXT',
  'END',
  'THEN',
  'NOW',
  'SUPER',
  'TITLE',
  'MONTAGE',
  'FLASHBACK',
  'BANG',
  'BOOM',
  'CRASH',
  'THUD',
  'SLAM',
  'KNOCK',
  'BEEP',
  'BUZZ',
  'CLICK',
  'SPLASH',
]);

/** Tuning for mention detection. */
export interface DetectOptions {
  /** Words never treated as names (upper-case). Defaults to {@link DEFAULT_STOP_WORDS}. */
  stopWords?: ReadonlySet<string>;
  /** Look for CAPITALISED names in action lines. Default true. */
  detectActionNames?: boolean;
}

/** Matches runs of capitalised words such as `MARIA` or `OLD MAN` (3+ letters each). */
const CAPS_RUN =
  /(?<![\p{L}\p{N}'’-])\p{Lu}[\p{Lu}'’-]{2,}(?:[ \t]+\p{Lu}[\p{Lu}'’-]{2,})*(?![\p{L}\p{N}])/gu;

/**
 * Creates a mention, resolving the name against known entities.
 * @param index Alias lookup over the project's entities.
 * @param text Name as written.
 * @param range Position of the name.
 * @param source Where it was found.
 * @param suggested Kind to suggest when the name is unknown.
 * @param allowed Entity kinds the name may resolve to.
 */
function mention(
  index: AliasIndex,
  text: string,
  range: Range,
  source: MentionSource,
  suggested: EntityKind,
  allowed: readonly EntityKind[],
): Mention {
  const found = index.resolve(text).filter((entity) => allowed.includes(entity.kind));
  const status = found.length === 0 ? 'unresolved' : found.length === 1 ? 'resolved' : 'ambiguous';
  return {
    text,
    range,
    source,
    kind: found[0]?.kind ?? suggested,
    status,
    entityIds: found.map((e) => e.id),
  };
}

/**
 * Finds every name in a screenplay that refers to a character, place or prop, and says whether it is known.
 * Characters come from dialogue cues, places from scene headings, and CAPITALISED words in action lines are guessed
 * to be characters (at the start of a sentence) or props.
 * @param doc Parsed screenplay.
 * @param entities The project's entities.
 * @param options Detection tuning.
 */
export function detectFountainMentions(
  doc: FountainDocument,
  entities: readonly Entity[],
  options: DetectOptions = {},
): Mention[] {
  const index = new AliasIndex(entities);
  const stop = options.stopWords ?? DEFAULT_STOP_WORDS;
  const cueNames = new Set(
    doc.elements.flatMap((element) =>
      element.type === 'character' ? [normalizeAlias(element.name)] : [],
    ),
  );
  const mentions: Mention[] = [];
  for (const element of doc.elements) {
    if (element.type === 'scene-heading' && element.locationName) {
      mentions.push(
        mention(index, element.locationName, element.locationRange, 'scene-heading', 'location', [
          'location',
        ]),
      );
    } else if (element.type === 'character') {
      mentions.push(
        mention(index, element.name, element.nameRange, 'character-cue', 'character', [
          'character',
        ]),
      );
    } else if (element.type === 'action' && options.detectActionNames !== false) {
      for (const found of element.text.matchAll(CAPS_RUN)) {
        const words = found[0].split(/[ \t]+/);
        let first = 0;
        let last = words.length;
        while (first < last && stop.has((words[first] ?? '').toUpperCase())) first++;
        while (last > first && stop.has((words[last - 1] ?? '').toUpperCase())) last--;
        if (first === last) continue;
        const text = words.slice(first, last).join(' ');
        const start = element.range.start + found.index + found[0].indexOf(text);
        const before = element.text.slice(0, found.index + found[0].indexOf(text)).trimEnd();
        const sentenceStart = before === '' || /[.!?:"“\n]$/.test(before);
        const known = cueNames.has(normalizeAlias(text));
        const suggested: EntityKind = known || sentenceStart ? 'character' : 'prop';
        mentions.push(
          mention(index, text, { start, end: start + text.length }, 'action', suggested, [
            'character',
            'location',
            'prop',
          ]),
        );
      }
    }
  }
  return mentions;
}

/**
 * Finds the singers and instruments named in a song outline and says whether they are known.
 * @param doc Parsed song.
 * @param entities The project's entities.
 */
export function detectSongMentions(doc: SongDocument, entities: readonly Entity[]): Mention[] {
  const index = new AliasIndex(entities);
  return doc.sections.flatMap((section) => [
    ...section.singers.map((s) => mention(index, s.name, s.range, 'singer', 'voice', ['voice'])),
    ...section.instruments.map((i) =>
      mention(index, i.name, i.nameRange, 'instrument', 'instrument', ['instrument']),
    ),
  ]);
}
