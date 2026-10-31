import type { ZodType } from 'zod';
import { fromZodError, ProjectFormatError } from './errors';
import type { FsPort } from './fs-port';
import { stableStringify } from './json';
import {
  PROJECT_FILE,
  SCRIPT_DIR,
  SCENES_DIR,
  SECTIONS_DIR,
  JOBS_DIR,
  ARTIFACTS_DIR,
  TIMELINE_DIR,
  artifactFile,
  entityFile,
  entityKindDir,
  jobFile,
  sceneFile,
  sectionFile,
  timelineFile,
} from './layout';
import { runMigrations } from './migrations';
import type { RawFiles } from './migrations';
import { ArtifactSchema } from './schema/artifacts';
import type { Artifact } from './schema/artifacts';
import { SCHEMA_VERSION } from './schema/common';
import { ENTITY_FOLDERS, EntitySchema } from './schema/entities';
import type { Entity, EntityKind } from './schema/entities';
import { JobSchema } from './schema/jobs';
import type { Job } from './schema/jobs';
import { ProjectSchema } from './schema/project';
import type { Project } from './schema/project';
import { TimelineSchema } from './schema/timeline';
import type { Timeline } from './schema/timeline';
import { SceneSchema, SectionSchema } from './schema/units';
import type { Scene, Section } from './schema/units';

/** Everything in a project folder that the studio itself manages, as typed values. Media files are not loaded. */
export interface ProjectData {
  project: Project;
  /** Plain-text script and lyric files by project-relative path. */
  scripts: Record<string, string>;
  entities: Entity[];
  scenes: Scene[];
  sections: Section[];
  jobs: Job[];
  artifacts: Artifact[];
  timelines: Timeline[];
}

/** The kinds of entity, in the order they are stored. */
const ENTITY_KINDS = Object.keys(ENTITY_FOLDERS) as EntityKind[];

/**
 * Lists `*.json` files directly inside a directory.
 * @param fs Project file system.
 * @param directory Project-relative directory.
 */
async function jsonFilesIn(fs: FsPort, directory: string): Promise<string[]> {
  const entries = await fs.list(directory);
  return entries
    .filter((e) => !e.isDirectory && e.name.endsWith('.json'))
    .map((e) => `${directory}/${e.name}`);
}

/**
 * Lists `<directory>/<child>/<fileName>` for every child directory that contains such a file.
 * @param fs Project file system.
 * @param directory Project-relative directory.
 * @param fileName Name of the file inside each child directory.
 */
async function childFiles(fs: FsPort, directory: string, fileName: string): Promise<string[]> {
  const entries = await fs.list(directory);
  const candidates = entries
    .filter((e) => e.isDirectory)
    .map((e) => `${directory}/${e.name}/${fileName}`);
  const found = await Promise.all(
    candidates.map(async (path) => ((await fs.exists(path)) ? path : undefined)),
  );
  return found.filter((path): path is string => path !== undefined);
}

/**
 * Finds every managed JSON file below the project folder (everything except `project.json`).
 * @param fs Project file system.
 */
async function discoverManagedFiles(fs: FsPort): Promise<string[]> {
  const groups = await Promise.all([
    ...ENTITY_KINDS.map((kind) => childFiles(fs, entityKindDir(kind), 'entity.json')),
    jsonFilesIn(fs, SCENES_DIR),
    jsonFilesIn(fs, SECTIONS_DIR),
    jsonFilesIn(fs, JOBS_DIR),
    childFiles(fs, ARTIFACTS_DIR, 'artifact.json'),
    jsonFilesIn(fs, TIMELINE_DIR),
  ]);
  return groups.flat();
}

/**
 * Reads and parses one JSON file.
 * @param fs Project file system.
 * @param path Project-relative path.
 * @throws {ProjectFormatError} When the file is not valid JSON.
 */
async function readJson(fs: FsPort, path: string): Promise<unknown> {
  const text = await fs.readText(path);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ProjectFormatError(path, [
      { path: '', message: `Invalid JSON: ${(error as Error).message}` },
    ]);
  }
}

/**
 * Validates one parsed file and checks that it lives where its kind and id say it should.
 * @param raw Parsed JSON.
 * @param path Project-relative path the data was read from.
 * @param schema Schema for this kind of file.
 * @param expectedPath Computes the canonical path of the parsed value.
 */
function parseFile<T>(
  raw: unknown,
  path: string,
  schema: ZodType<T>,
  expectedPath: (value: T) => string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw fromZodError(path, result.error);
  const expected = expectedPath(result.data);
  if (expected !== path) {
    throw new ProjectFormatError(path, [
      { path: 'id', message: `File must be stored at ${expected}` },
    ]);
  }
  return result.data;
}

/**
 * Orders scenes or sections by their position in the script.
 * @param a First item.
 * @param b Second item.
 */
const byNumber = (a: { number: number }, b: { number: number }): number => a.number - b.number;

/**
 * Loads a project folder: reads, migrates to the current format, and validates every managed file.
 * @param fs File system rooted at the project folder.
 * @throws {ProjectFormatError} Naming the file and field of the first problem found.
 */
export async function loadProject(fs: FsPort): Promise<ProjectData> {
  if (!(await fs.exists(PROJECT_FILE))) {
    throw new ProjectFormatError(PROJECT_FILE, [
      { path: '', message: 'Not found; is this a Tapestry Studio project?' },
    ]);
  }
  const paths = [PROJECT_FILE, ...(await discoverManagedFiles(fs))];
  const parsed = await Promise.all(
    paths.map(async (path) => [path, await readJson(fs, path)] as const),
  );
  let raw: RawFiles = Object.fromEntries(parsed);
  const version = (raw[PROJECT_FILE] as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version !== 'number') {
    throw new ProjectFormatError(PROJECT_FILE, [
      { path: 'schemaVersion', message: 'Missing or not a number' },
    ]);
  }
  raw = runMigrations(raw, version, SCHEMA_VERSION);

  const scriptEntries = (await fs.list(SCRIPT_DIR)).filter((e) => !e.isDirectory);
  const scripts = Object.fromEntries(
    await Promise.all(
      scriptEntries.map(async (e) => [
        `${SCRIPT_DIR}/${e.name}`,
        await fs.readText(`${SCRIPT_DIR}/${e.name}`),
      ]),
    ),
  );

  /** Parses every file below a directory prefix with one schema. */
  const collect = <T>(
    prefix: string,
    schema: ZodType<T>,
    expectedPath: (value: T) => string,
  ): T[] =>
    Object.keys(raw)
      .filter((path) => path.startsWith(prefix))
      .map((path) => parseFile(raw[path], path, schema, expectedPath));

  return {
    project: parseFile(raw[PROJECT_FILE], PROJECT_FILE, ProjectSchema, () => PROJECT_FILE),
    scripts,
    entities: collect('entities/', EntitySchema, (e) => entityFile(e.kind, e.id)),
    // Files are read in file-name (creation) order; scenes and sections belong in script order.
    scenes: collect(`${SCENES_DIR}/`, SceneSchema, (s) => sceneFile(s.id)).sort(byNumber),
    sections: collect(`${SECTIONS_DIR}/`, SectionSchema, (s) => sectionFile(s.id)).sort(byNumber),
    jobs: collect(`${JOBS_DIR}/`, JobSchema, (j) => jobFile(j.id)),
    artifacts: collect(`${ARTIFACTS_DIR}/`, ArtifactSchema, (a) => artifactFile(a.id)),
    timelines: collect(`${TIMELINE_DIR}/`, TimelineSchema, (t) => timelineFile(t.id)),
  };
}

/**
 * Validates project data and renders every managed file to text without touching the disk.
 * @param data Project to serialise; written at the current format version.
 * @returns Project-relative path to file contents, deterministic for identical data.
 * @throws {ProjectFormatError} When any value does not match its schema.
 */
export function serializeProject(data: ProjectData): Record<string, string> {
  const files: Record<string, string> = {};
  /** Validates one value and records its text under the given path. */
  const add = <T>(schema: ZodType<T>, value: T, path: string): void => {
    const result = schema.safeParse(value);
    if (!result.success) throw fromZodError(path, result.error);
    files[path] = stableStringify(result.data);
  };
  add(ProjectSchema, { ...data.project, schemaVersion: SCHEMA_VERSION }, PROJECT_FILE);
  for (const entity of data.entities) add(EntitySchema, entity, entityFile(entity.kind, entity.id));
  for (const scene of data.scenes) add(SceneSchema, scene, sceneFile(scene.id));
  for (const section of data.sections) add(SectionSchema, section, sectionFile(section.id));
  for (const job of data.jobs) add(JobSchema, job, jobFile(job.id));
  for (const artifact of data.artifacts) add(ArtifactSchema, artifact, artifactFile(artifact.id));
  for (const timeline of data.timelines) add(TimelineSchema, timeline, timelineFile(timeline.id));
  return files;
}

/**
 * Saves a project. All values are validated before anything is written. Managed JSON files of items that no longer
 * exist in `data` are removed; media files and scripts are never deleted.
 * @param fs File system rooted at the project folder.
 * @param data Complete project state.
 * @throws {ProjectFormatError} When validation fails (nothing is written in that case).
 */
export async function saveProject(fs: FsPort, data: ProjectData): Promise<void> {
  const files = serializeProject(data);
  await Promise.all(Object.entries(files).map(([path, text]) => fs.writeText(path, text)));
  await Promise.all(Object.entries(data.scripts).map(([path, text]) => fs.writeText(path, text)));
  const stale = (await discoverManagedFiles(fs)).filter((path) => !(path in files));
  await Promise.all(stale.map((path) => fs.remove(path)));
}
