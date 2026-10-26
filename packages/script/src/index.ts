/**
 * The script engine: parses screenplays (Fountain, Final Draft) and song outlines, finds the names in them (characters,
 * places, props, singers, instruments), and derives scene and section units that keep their ids across edits.
 * Pure TypeScript: no Node or Electron imports (see doc/readme/architecture.md).
 */
export * from './align';
export * from './analyze';
export * from './derive';
export * from './detect';
export * from './fdx';
export * from './fountain';
export * from './song';
export * from './types';
