import { ProjectFormatError } from './errors';

/** Parsed contents of every JSON file in a project, keyed by project-relative path. Migrations work on this form. */
export type RawFiles = Record<string, unknown>;

/** Upgrade of the on-disk format by one version. */
export interface Migration {
  /** Version this migration reads. */
  from: number;
  /** Version it produces; always `from + 1`. */
  to: number;
  /**
   * Transforms the files. Must not mutate its input.
   * @param files All JSON files of the project at version `from`.
   * @returns The files at version `to`, including the updated `schemaVersion` in `project.json`.
   */
  migrate(files: RawFiles): RawFiles;
}

/** Migrations shipped with this version of the app, oldest first. Empty while the format is at version 1. */
export const MIGRATIONS: readonly Migration[] = [];

/**
 * Upgrades project files step by step.
 * @param files Parsed JSON files at version `from`.
 * @param from Version found in `project.json`.
 * @param to Version the app expects.
 * @param migrations Available migrations (defaults to the shipped ones).
 * @throws {ProjectFormatError} When the project is newer than the app or a step is missing.
 */
export function runMigrations(
  files: RawFiles,
  from: number,
  to: number,
  migrations: readonly Migration[] = MIGRATIONS,
): RawFiles {
  if (from > to) {
    throw new ProjectFormatError('project.json', [
      {
        path: 'schemaVersion',
        message: `Project format ${from} is newer than this app supports (${to}); update the app`,
      },
    ]);
  }
  let current = files;
  for (let version = from; version < to; version++) {
    const step = migrations.find((migration) => migration.from === version);
    if (!step) {
      throw new ProjectFormatError('project.json', [
        {
          path: 'schemaVersion',
          message: `No migration from project format ${version} to ${version + 1}`,
        },
      ]);
    }
    current = step.migrate(current);
  }
  return current;
}
