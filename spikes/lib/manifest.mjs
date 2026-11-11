import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Roles a clip can have in the draft and final comparison. */
export const ROLES = ['draft', 'final'];

/**
 * Reads the list of clips made for the draft and final comparison.
 * @param {string} file Path of `manifest.json`.
 * @returns {{ version: number, clips: Record<string, any>[] }} The manifest; an empty one when the file is missing.
 */
export function readManifest(file) {
  if (!existsSync(file)) return { version: 1, clips: [] };
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Adds a clip to the manifest, replacing an earlier clip with the same id (so a re-run updates it).
 * @param {string} file Path of `manifest.json`; its folder is created when missing.
 * @param {Record<string, any>} clip The clip. Needs `id`, `shot`, `role` and `file`.
 * @returns {{ version: number, clips: Record<string, any>[] }} The updated manifest.
 */
export function upsertClip(file, clip) {
  for (const key of ['id', 'shot', 'role', 'file']) {
    if (!clip[key]) throw new Error(`Clip needs a ${key}`);
  }
  if (!ROLES.includes(clip.role)) throw new Error(`role must be one of ${ROLES.join(', ')}`);
  if (clip.role === 'final' && !clip.source)
    throw new Error('A final needs the id of its source draft');
  const manifest = readManifest(file);
  manifest.clips = [...manifest.clips.filter((c) => c.id !== clip.id), clip];
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
