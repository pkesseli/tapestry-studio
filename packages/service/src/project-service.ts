import { createEntity, createProject, loadProject, saveProject } from '@tapestry/core';
import type { Entity, FsPort, NewEntityInput, ProjectData, Scene } from '@tapestry/core';
import { analyze, deriveScenes } from '@tapestry/script';
import { MAIN_SCRIPT, STARTER_PROJECT_NAME, STARTER_SCREENPLAY } from './starter';

/** What the Write section shows: the screenplay, who is in the cast, and the scenes derived from the text. */
export interface StudioState {
  projectName: string;
  /** Project-relative path of the screenplay being edited. */
  scriptPath: string;
  scriptText: string;
  entities: Entity[];
  scenes: Scene[];
}

/** Options for creating a project that does not exist yet. */
export interface OpenOptions {
  /** Name of the new project. */
  name?: string;
  /** Text of the first screenplay. */
  screenplay?: string;
}

/** Script files live in `script/` and have simple names; anything else is refused. */
const SCRIPT_PATH = /^script\/[A-Za-z0-9._-]+$/;

/**
 * The application layer over a project folder: every use case the interface needs (open, edit the script, add to the
 * cast) lives here, free of any UI, so the desktop app, the command line and a future remote client share it.
 * Operations run one after another so overlapping saves cannot interleave.
 */
export class ProjectService {
  /** Tail of the operation chain. */
  private chain: Promise<unknown> = Promise.resolve();

  /** Use {@link ProjectService.open}. */
  private constructor(
    private readonly fs: FsPort,
    private data: ProjectData,
  ) {}

  /**
   * Opens the project in a folder, creating it (with an example screenplay) when the folder holds none.
   * @param fs File system rooted at the project folder.
   * @param options Name and first screenplay for a new project.
   * @throws {ProjectFormatError} When an existing project has invalid files.
   */
  static async open(fs: FsPort, options: OpenOptions = {}): Promise<ProjectService> {
    if (await fs.exists('project.json')) {
      const data = await loadProject(fs);
      data.scripts[MAIN_SCRIPT] ??= '';
      return new ProjectService(fs, data);
    }
    const data: ProjectData = {
      project: createProject(options.name ?? STARTER_PROJECT_NAME),
      scripts: { [MAIN_SCRIPT]: options.screenplay ?? STARTER_SCREENPLAY },
      entities: [],
      scenes: [],
      sections: [],
      jobs: [],
      artifacts: [],
      timelines: [],
    };
    const service = new ProjectService(fs, data);
    service.rederive();
    await saveProject(fs, service.data);
    return service;
  }

  /** The current state for the Write section. */
  state(): StudioState {
    return {
      projectName: this.data.project.name,
      scriptPath: MAIN_SCRIPT,
      scriptText: this.data.scripts[MAIN_SCRIPT] ?? '',
      entities: this.data.entities,
      scenes: this.data.scenes,
    };
  }

  /**
   * Stores new screenplay text and refreshes the scenes derived from it (scenes keep their ids and shots).
   * @param path Project-relative script path.
   * @param text Complete new text.
   * @throws {Error} When the path is not a script file.
   */
  saveScript(path: string, text: string): Promise<StudioState> {
    if (!SCRIPT_PATH.test(path)) return Promise.reject(new Error(`Not a script file: ${path}`));
    return this.serialize(async () => {
      this.data = { ...this.data, scripts: { ...this.data.scripts, [path]: text } };
      this.rederive();
      await saveProject(this.fs, this.data);
      return this.state();
    });
  }

  /**
   * Adds a character, place or prop to the cast and re-reads the script, so names that pointed at nothing now resolve.
   * @param input Kind, name and optional description.
   * @throws {Error} When the name is blank or already used by an entity of that kind.
   */
  createEntity(input: NewEntityInput): Promise<StudioState> {
    return this.serialize(async () => {
      const entity = createEntity(input);
      const taken = this.data.entities.some(
        (e) => e.kind === entity.kind && e.name.toLowerCase() === entity.name.toLowerCase(),
      );
      if (taken) throw new Error(`${entity.name} already exists`);
      this.data = { ...this.data, entities: [...this.data.entities, entity] };
      this.rederive();
      await saveProject(this.fs, this.data);
      return this.state();
    });
  }

  /** Re-derives the scenes from the main screenplay and the current cast. */
  private rederive(): void {
    const analysis = analyze('fountain', this.data.scripts[MAIN_SCRIPT] ?? '', this.data.entities);
    if (!analysis.fountain) return;
    const scenes = deriveScenes(analysis.fountain, analysis.mentions, this.data.scenes);
    this.data = { ...this.data, scenes };
  }

  /**
   * Runs an operation after all earlier ones have finished; one failure does not block the next.
   * @param work The operation.
   */
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.chain.then(work);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
