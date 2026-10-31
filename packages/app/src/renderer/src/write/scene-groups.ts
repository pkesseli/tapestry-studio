import { normalizeAlias } from '@tapestry/core';
import type { ActItem, SceneItem } from './scenes';

/** A scene together with its position in the whole list (the list may be filtered). */
export interface IndexedScene {
  item: SceneItem;
  /** Index in the unfiltered list of scenes. */
  index: number;
}

/** A run of scenes under one act heading; scenes before the first act (or in a script without acts) have none. */
export interface SceneGroup {
  act: string | undefined;
  /** The act's own line in the script, when it has one. */
  actItem?: ActItem;
  /** The scenes under the act; empty for an act that has no scene yet. */
  scenes: IndexedScene[];
}

/**
 * Groups scenes by the act they sit under, keeping the script's order. Acts without any scene still get a group, so
 * they stay visible (and can be deleted).
 * @param items All scenes.
 * @param acts All act headings of the script.
 */
export function groupScenes(
  items: readonly SceneItem[],
  acts: readonly ActItem[] = [],
): SceneGroup[] {
  const events = [
    ...acts.map((actItem) => ({ pos: actItem.start, actItem })),
    ...items.map((item, index) => ({ pos: item.start, item, index })),
  ].sort((x, y) => x.pos - y.pos || Number('item' in x) - Number('item' in y));
  const groups: SceneGroup[] = [];
  for (const event of events) {
    if ('actItem' in event) {
      groups.push({ act: event.actItem.name, actItem: event.actItem, scenes: [] });
      continue;
    }
    const last = groups[groups.length - 1];
    const entry = { item: event.item, index: event.index };
    if (last && last.act === event.item.act) last.scenes.push(entry);
    else groups.push({ act: event.item.act, scenes: [entry] });
  }
  return groups;
}

/**
 * Tells whether text contains every word of a search, ignoring case and accents.
 * @param text Text to look in.
 * @param query What the user typed; an empty search matches everything.
 */
export function matchesWords(text: string, query: string): boolean {
  const words = normalizeAlias(query).split(' ').filter(Boolean);
  const haystack = normalizeAlias(text);
  return words.every((word) => haystack.includes(word));
}

/**
 * Tells whether a scene matches a search: every word typed must appear somewhere in the scene's title, heading, act or
 * the names written in it, so "maria cabin" finds the cabin scene Maria is in.
 * @param item The scene.
 * @param query What the user typed.
 */
export function matchesQuery(item: SceneItem, query: string): boolean {
  return matchesWords([item.title, item.heading, item.act ?? '', ...item.names].join(' '), query);
}

/**
 * Keeps only what matches a search: matching scenes, and the act headings above them. An act whose own name matches
 * keeps all its scenes.
 * @param groups All groups.
 * @param query What the user typed.
 */
export function filterGroups(groups: readonly SceneGroup[], query: string): SceneGroup[] {
  if (normalizeAlias(query) === '') return [...groups];
  return groups.flatMap((group) => {
    const actMatches = group.act !== undefined && matchesWords(group.act, query);
    const scenes = actMatches
      ? group.scenes
      : group.scenes.filter(({ item }) => matchesQuery(item, query));
    return scenes.length > 0 || actMatches ? [{ ...group, scenes }] : [];
  });
}
