import { newId } from './ids';
import type { Entity, EntityKind } from './schema/entities';
import type { Project } from './schema/project';
import { SCHEMA_VERSION } from './schema/common';

/** What the user types when adding an entity: its kind, name and an optional one-line description. */
export interface NewEntityInput {
  kind: EntityKind;
  name: string;
  description?: string;
}

/** Id prefix of each entity kind. */
const PREFIX = {
  character: 'chr',
  location: 'loc',
  prop: 'prp',
  voice: 'voc',
  instrument: 'ins',
} as const;

/**
 * Creates a new entity with empty details, ready to be shown in the library and refined later.
 * @param input Kind, name and optional description.
 * @throws {Error} When the name is blank.
 */
export function createEntity(input: NewEntityInput): Entity {
  const name = input.name.trim();
  if (!name) throw new Error('An entity needs a name');
  const base = {
    name,
    aliases: [],
    description: input.description?.trim() ?? '',
    references: [],
    canonicalSheet: [],
    notes: '',
  };
  switch (input.kind) {
    case 'character':
      return {
        ...base,
        kind: 'character',
        id: newId(PREFIX.character),
        appearance: '',
        wardrobe: [],
      };
    case 'location':
      return {
        ...base,
        kind: 'location',
        id: newId(PREFIX.location),
        mood: '',
        lighting: '',
        timeVariants: [],
      };
    case 'prop':
      return { ...base, kind: 'prop', id: newId(PREFIX.prop) };
    case 'voice':
      return { ...base, kind: 'voice', id: newId(PREFIX.voice), style: '' };
    case 'instrument':
      return {
        ...base,
        kind: 'instrument',
        id: newId(PREFIX.instrument),
        family: '',
        timbre: '',
        role: 'other',
      };
  }
}

/**
 * Creates the manifest of a new, empty project with sensible defaults.
 * @param name Project name shown in the app.
 * @param now Creation time; only tests pass it.
 */
export function createProject(name: string, now: Date = new Date()): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('prj'),
    name,
    createdAt: now.toISOString(),
    settings: { aspectRatio: '16:9', fps: 24, simpleMode: true, defaultProviders: {} },
  };
}
