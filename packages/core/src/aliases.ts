import type { Entity } from './schema/entities';

/**
 * Normalises a name for matching: strips diacritics, lower-cases and collapses whitespace, so "María", "MARIA" and
 * " maria  " all compare equal.
 * @param name Name or alias as written in a script.
 */
export function normalizeAlias(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** An alias claimed by more than one entity. */
export interface AliasConflict {
  /** The normalised alias. */
  alias: string;
  /** All entities that claim it. */
  entities: readonly Entity[];
}

/** Lookup from the names and aliases used in a script to entities. */
export class AliasIndex {
  /** Entities by normalised name or alias. */
  private readonly byAlias = new Map<string, Entity[]>();

  /**
   * Builds the index from a set of entities; every entity is reachable by its name and each of its aliases.
   * @param entities All entities of a project.
   */
  constructor(entities: readonly Entity[]) {
    for (const entity of entities) {
      for (const name of [entity.name, ...entity.aliases]) {
        const key = normalizeAlias(name);
        const bucket = this.byAlias.get(key) ?? [];
        if (!bucket.includes(entity)) bucket.push(entity);
        this.byAlias.set(key, bucket);
      }
    }
  }

  /**
   * Finds entities for a name. No result means the mention is unresolved (the editor offers to create it); more than
   * one means it is ambiguous.
   * @param name Name as written in the script.
   */
  resolve(name: string): readonly Entity[] {
    return this.byAlias.get(normalizeAlias(name)) ?? [];
  }

  /** Lists aliases that point at more than one entity. */
  conflicts(): AliasConflict[] {
    return [...this.byAlias]
      .filter(([, entities]) => entities.length > 1)
      .map(([alias, entities]) => ({ alias, entities }));
  }
}
