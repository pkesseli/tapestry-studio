import type { Id } from './ids';
import { ENTITY_FOLDERS } from './schema/entities';
import type { EntityKind } from './schema/entities';

/** Path of the project manifest. */
export const PROJECT_FILE = 'project.json';

/** Folder holding the plain-text script and lyric files. */
export const SCRIPT_DIR = 'script';

/** Folder holding one JSON file per scene. */
export const SCENES_DIR = 'units/scenes';

/** Folder holding one JSON file per song section. */
export const SECTIONS_DIR = 'units/sections';

/** Folder holding one JSON file per job. */
export const JOBS_DIR = 'jobs';

/** Folder holding one subfolder per artifact. */
export const ARTIFACTS_DIR = 'artifacts';

/** Folder holding one JSON file per timeline. */
export const TIMELINE_DIR = 'timeline';

/** Folder that holds all entities of one kind. */
export function entityKindDir(kind: EntityKind): string {
  return `entities/${ENTITY_FOLDERS[kind]}`;
}

/**
 * Path of an entity's JSON file.
 * @param kind Entity kind.
 * @param id Entity id.
 */
export function entityFile(kind: EntityKind, id: Id): string {
  return `${entityKindDir(kind)}/${id}/entity.json`;
}

/** Path of a scene's JSON file. */
export function sceneFile(id: Id<'scn'>): string {
  return `${SCENES_DIR}/${id}.json`;
}

/** Path of a section's JSON file. */
export function sectionFile(id: Id<'sec'>): string {
  return `${SECTIONS_DIR}/${id}.json`;
}

/** Path of a job's JSON file. */
export function jobFile(id: Id<'job'>): string {
  return `${JOBS_DIR}/${id}.json`;
}

/** Path of an artifact's JSON file. */
export function artifactFile(id: Id<'art'>): string {
  return `${ARTIFACTS_DIR}/${id}/artifact.json`;
}

/** Path of a timeline's JSON file. */
export function timelineFile(id: Id<'tln'>): string {
  return `${TIMELINE_DIR}/${id}.json`;
}
