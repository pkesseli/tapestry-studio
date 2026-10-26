import { normalizeAlias } from '@tapestry/core';
import type { Entity, EntityKind } from '@tapestry/core';
import { detectFountainMentions, detectSongMentions } from './detect';
import type { DetectOptions } from './detect';
import { fdxToFountain } from './fdx';
import { parseFountain } from './fountain';
import type { FountainDocument } from './fountain';
import { parseSong } from './song';
import type { SongDocument } from './song';
import type { Diagnostic, Mention, ScriptKind } from './types';

/** Everything the editor needs to know about a text. */
export interface Analysis {
  kind: ScriptKind;
  /** The analysed text (for `.fdx` imports: the converted Fountain text). */
  text: string;
  fountain?: FountainDocument;
  song?: SongDocument;
  /** Names found in the text, sorted by position. */
  mentions: Mention[];
  diagnostics: Diagnostic[];
}

/** Names that appear in the text but do not exist yet, grouped for a "create these" panel. */
export interface UnresolvedGroup {
  /** The name as first written. */
  name: string;
  kind: EntityKind;
  /** How many times it appears. */
  count: number;
  /** Position of its first appearance. */
  first: Mention['range'];
}

/**
 * Decides how a file is read from its name.
 * @param path File name or project-relative path.
 * @returns The kind of writing, or `undefined` for files that are not scripts.
 */
export function scriptKindOf(path: string): ScriptKind | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('.song.md')) return 'song';
  if (/\.(fountain|spmd|txt)$/.test(lower)) return 'fountain';
  return undefined;
}

/**
 * Parses a text, finds the names in it and reports problems. Fast enough to run on every keystroke for a full-length
 * screenplay.
 * @param kind Screenplay or song.
 * @param text The text.
 * @param entities The project's entities.
 * @param options Detection tuning for screenplays.
 */
export function analyze(
  kind: ScriptKind,
  text: string,
  entities: readonly Entity[],
  options?: DetectOptions,
): Analysis {
  const diagnostics: Diagnostic[] = [];
  let fountain: FountainDocument | undefined;
  let song: SongDocument | undefined;
  let mentions: Mention[];
  if (kind === 'song') {
    song = parseSong(text);
    mentions = detectSongMentions(song, entities);
    diagnostics.push(...song.diagnostics);
  } else {
    fountain = parseFountain(text);
    mentions = detectFountainMentions(fountain, entities, options);
  }
  mentions.sort((a, b) => a.range.start - b.range.start);
  for (const m of mentions.filter((m) => m.status === 'ambiguous')) {
    diagnostics.push({
      range: m.range,
      severity: 'warning',
      message: `"${m.text}" could be more than one ${m.kind}`,
    });
  }
  return {
    kind,
    text,
    ...(fountain && { fountain }),
    ...(song && { song }),
    mentions,
    diagnostics,
  };
}

/**
 * Analyses an imported file: Final Draft files are converted first, other screenplay formats are read directly.
 * @param path File name, used to choose the format.
 * @param content File contents.
 * @param entities The project's entities.
 */
export function importScript(path: string, content: string, entities: readonly Entity[]): Analysis {
  const kind = scriptKindOf(path) ?? (path.toLowerCase().endsWith('.fdx') ? 'fountain' : undefined);
  if (!kind) throw new Error(`Cannot import ${path}: unknown script format`);
  return analyze(
    kind,
    path.toLowerCase().endsWith('.fdx') ? fdxToFountain(content) : content,
    entities,
  );
}

/**
 * Finds the mention at a cursor position (touching its first character up to just after its last).
 * @param analysis Result of {@link analyze}.
 * @param offset Cursor offset in the text.
 */
export function mentionAt(analysis: Analysis, offset: number): Mention | undefined {
  const { mentions } = analysis;
  let low = 0;
  let high = mentions.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const m = mentions[mid] as Mention;
    if (offset < m.range.start) high = mid - 1;
    else if (offset > m.range.end) low = mid + 1;
    else return m;
  }
  return undefined;
}

/**
 * Suggests existing entities for a partly typed name, for autocomplete.
 * @param entities The project's entities.
 * @param prefix What the user typed so far.
 * @param kinds Entity kinds to offer; all when omitted.
 * @param limit Maximum number of suggestions.
 */
export function completions(
  entities: readonly Entity[],
  prefix: string,
  kinds?: readonly EntityKind[],
  limit = 8,
): Entity[] {
  const wanted = normalizeAlias(prefix);
  if (!wanted) return [];
  const hits = new Set<Entity>();
  for (const entity of entities) {
    if (kinds && !kinds.includes(entity.kind)) continue;
    if ([entity.name, ...entity.aliases].some((name) => normalizeAlias(name).startsWith(wanted)))
      hits.add(entity);
  }
  return [...hits].slice(0, limit);
}

/**
 * Groups the unresolved mentions by name and kind.
 * @param mentions Mentions from {@link analyze}.
 */
export function summarizeUnresolved(mentions: readonly Mention[]): UnresolvedGroup[] {
  const groups = new Map<string, UnresolvedGroup>();
  for (const m of mentions.filter((m) => m.status === 'unresolved')) {
    const key = `${m.kind}:${normalizeAlias(m.text)}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { name: m.text, kind: m.kind, count: 1, first: m.range });
  }
  return [...groups.values()];
}
