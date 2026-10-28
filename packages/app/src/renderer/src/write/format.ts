import type { EntityKind } from '@tapestry/core';

/**
 * Turns a name as written in a screenplay into the name shown in the cast: ALL CAPS names become "Nora" or "Old man",
 * mixed-case names such as "McClane" are kept as typed.
 * @param text Name as written.
 * @param eachWord Capitalise every word (for people) instead of only the first (for places and things).
 */
export function displayName(text: string, eachWord = true): string {
  const trimmed = text.trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  const lower = trimmed.toLowerCase();
  if (!eachWord) return lower.charAt(0).toUpperCase() + lower.slice(1);
  return lower.replace(
    /(^|[\s-])(\p{L})/gu,
    (_, before: string, letter: string) => before + letter.toUpperCase(),
  );
}

/**
 * The short title of a scene for the scene list, for example "Harbor, night".
 * @param heading The scene heading as written (`INT. HARBOR - NIGHT`).
 * @param locationName The place part of the heading.
 * @param timeOfDay The time part of the heading, if any.
 */
export function sceneTitle(
  heading: string,
  locationName: string,
  timeOfDay: string | undefined,
): string {
  if (!locationName) return heading.replace(/\s#[^#]+#\s*$/, '');
  const place = displayName(locationName, false);
  return timeOfDay ? `${place}, ${timeOfDay.toLowerCase().replace(/\s+-\s+/g, ', ')}` : place;
}

/** What each entity kind is called in the interface. */
export const KIND_LABEL: Record<EntityKind, string> = {
  character: 'Character',
  location: 'Place',
  prop: 'Prop',
  voice: 'Voice',
  instrument: 'Instrument',
};

/**
 * The name of the modifier key for shortcuts on this platform.
 * @param platform Value of `window.tapestry.platform`.
 */
export function modifierLabel(platform: string): string {
  return platform === 'darwin' ? '⌘' : 'Ctrl';
}
