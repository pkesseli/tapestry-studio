import {
  WORKSPACE_FILE,
  WorkspaceSchema,
  createEntity,
  createProject,
  loadProject,
  saveProject,
  stableStringify,
} from '@tapestry/core';
import type {
  Entity,
  FsPort,
  NewEntityInput,
  ProjectData,
  Quality,
  Scene,
  Workspace,
} from '@tapestry/core';
import { ProviderRegistry, mockProviderDefinition } from '@tapestry/providers';
import type { ProviderManifest } from '@tapestry/providers';
import type { QueueOptions } from '@tapestry/queue';
import { analyze, deriveScenes, exportScreenplay } from '@tapestry/script';
import type { ExportOptions } from '@tapestry/script';
import { clipsOf, planSampleFootage, takesOf } from './footage';
import type { SampleClip, SceneClip, ShotTake } from './footage';
import { Production } from './production';
import { acceptOne, startAnother, startFinal, startShot } from './shot-actions';
import type { ActionContext } from './shot-actions';
import { MAIN_SCRIPT, STARTER_PROJECT_NAME, STARTER_SCREENPLAY } from './starter';

/** What the Write section shows: the screenplay, who is in the cast, and the scenes derived from the text. */
export interface StudioState {
  projectName: string;
  /** Project-relative path of the screenplay being edited. */
  scriptPath: string;
  scriptText: string;
  entities: Entity[];
  scenes: Scene[];
  /** Videos made for the shots of the scenes (none until something has been made). */
  clips: SceneClip[];
  /** Every attempt at every shot, including those still being made, so the interface can show progress and choices. */
  takes: ShotTake[];
  /** Where the user was working last: the scene, the cursor and which acts are folded. */
  workspace: Workspace;
}

/** Options for creating a project that does not exist yet. */
export interface OpenOptions {
  /** Name of the new project. */
  name?: string;
  /** Text of the first screenplay. */
  screenplay?: string;
  /** Providers the project can use. Default: only the mock provider, which makes placeholder media (practice mode). */
  registry?: ProviderRegistry;
  /** Provider that "make this shot" uses. Default: `mock`. */
  providerId?: string;
  /** Queue settings, for example a faster clock in tests. */
  queue?: Partial<QueueOptions>;
  /** Random numbers in [0, 1) for seeds; tests inject a fixed one. */
  random?: () => number;
}

/** Saves that leave the job and artifact files to the queue, which owns them while the app runs. */
const QUEUE_OWNS = { leaveQueueFiles: true } as const;

/**
 * Reads the remembered workspace. A missing or damaged file never blocks opening a project: it only means starting fresh.
 * @param fs Project file system.
 */
async function readWorkspace(fs: FsPort): Promise<Workspace> {
  try {
    const parsed = WorkspaceSchema.safeParse(JSON.parse(await fs.readText(WORKSPACE_FILE)));
    if (parsed.success) return parsed.data;
  } catch {
    // No workspace yet, or unreadable: start fresh.
  }
  return { collapsedActs: [] };
}

/** The providers every project has: the mock provider, which makes placeholder media for practice mode. */
function defaultRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(mockProviderDefinition);
  return registry;
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
  /** The project's generation work; set right after construction. */
  private production!: Production;
  /** Providers the project can use. */
  private readonly registry: ProviderRegistry;
  /** Who wants to hear that something changed. */
  private readonly listeners = new Set<() => void>();

  /** Use {@link ProjectService.open}. */
  private constructor(
    private readonly fs: FsPort,
    private data: ProjectData,
    private workspace: Workspace,
    private readonly options: OpenOptions,
  ) {
    this.registry = options.registry ?? defaultRegistry();
  }

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
      return new ProjectService(fs, data, await readWorkspace(fs), options).start();
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
    const service = new ProjectService(fs, data, { collapsedActs: [] }, options);
    service.rederive();
    await saveProject(fs, service.data);
    return service.start();
  }

  /** Opens the generation queue and brings the in-memory project in line with it. */
  private async start(): Promise<this> {
    this.production = await Production.open(
      { fs: this.fs, registry: this.registry, ...this.options.queue },
      () => this.queueChanged(),
    );
    await this.serialize(() => this.syncRuntime());
    return this;
  }

  /** The current state for the Write section. */
  state(): StudioState {
    return {
      projectName: this.data.project.name,
      scriptPath: MAIN_SCRIPT,
      scriptText: this.data.scripts[MAIN_SCRIPT] ?? '',
      entities: this.data.entities,
      scenes: this.data.scenes,
      clips: clipsOf(this.data),
      takes: takesOf(this.data),
      workspace: this.workspace,
    };
  }

  /**
   * Remembers where the user is working (scene, cursor, folded acts). Only the given fields change.
   * @param update Fields to change.
   * @throws {Error} When the result is not a valid workspace.
   */
  saveWorkspace(update: Partial<Workspace>): Promise<StudioState> {
    return this.serialize(async () => {
      const parsed = WorkspaceSchema.safeParse({ ...this.workspace, ...update });
      if (!parsed.success) throw new Error('Invalid workspace state');
      this.workspace = parsed.data;
      await this.fs.writeText(WORKSPACE_FILE, stableStringify(parsed.data));
      return this.state();
    });
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
      await saveProject(this.fs, this.data, QUEUE_OWNS);
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
      await saveProject(this.fs, this.data, QUEUE_OWNS);
      return this.state();
    });
  }

  /**
   * Gives the first shots of every scene that have no video yet a finished sample take, so the interface can be tried
   * with footage before real generation exists. The first shot of each scene is accepted, the rest are ready to review.
   * @param clips Videos to hand out in order.
   */
  addSampleFootage(clips: SampleClip[]): Promise<StudioState> {
    return this.serialize(async () => {
      await this.syncRuntime();
      const plan = await planSampleFootage(this.data, clips);
      await Promise.all(plan.files.map((file) => this.fs.writeBytes(file.path, file.bytes)));
      this.data = {
        ...this.data,
        jobs: [...this.data.jobs, ...plan.jobs],
        artifacts: [...this.data.artifacts, ...plan.artifacts],
      };
      await saveProject(this.fs, this.data);
      return this.state();
    });
  }

  /**
   * Starts making a shot. A draft (the default) is the cheap preview of framing and movement; a final is the quality that
   * goes into the film. The request is composed from the script, the cast and the provider's limits, and the job starts
   * at once when the provider is free to use.
   * @param shotId The shot to make.
   * @param quality `draft` or `final`.
   * @throws {Error} When the shot or the provider does not exist, or the request does not fit the provider.
   */
  makeShot(shotId: string, quality: Quality = 'draft'): Promise<StudioState> {
    return this.serialize(async () => {
      await startShot(this.context(), shotId, quality);
      return this.refreshed();
    });
  }

  /**
   * Starts the final of an accepted draft: a fresh render at final quality with the draft's prompt, references and seed.
   * @param draftJobId The accepted draft take.
   * @throws {Error} When the job is not an accepted draft with a seed.
   */
  makeFinal(draftJobId: string): Promise<StudioState> {
    return this.serialize(async () => {
      await startFinal(this.context(), draftJobId);
      return this.refreshed();
    });
  }

  /**
   * Accepts a finished take: it is frozen and becomes the shot's footage at that quality. A shot has at most one
   * accepted take per quality; replacing it takes an explicit decision (un-accept first).
   * @param jobId The take.
   * @throws {Error} When another take of the same shot and quality is already accepted.
   */
  acceptTake(jobId: string): Promise<StudioState> {
    return this.serialize(async () => {
      await acceptOne(this.context(), jobId);
      return this.refreshed();
    });
  }

  /**
   * Rejects a finished take and starts another attempt at the same shot with a new seed. The rejected files stay.
   * @param jobId The take to replace.
   */
  anotherTake(jobId: string): Promise<StudioState> {
    return this.serialize(async () => {
      await startAnother(this.context(), jobId);
      return this.refreshed();
    });
  }

  /** Resolves when no take is queued or running and the project reflects the results. */
  async waitUntilIdle(): Promise<void> {
    await this.production.idle();
    await this.serialize(() => this.syncRuntime());
  }

  /**
   * Subscribes to changes made by background work (a take finished, failed or moved on).
   * @param listener Called after the project's state has been refreshed.
   * @returns A function that unsubscribes.
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * The screenplay as a clean script for printing or sharing: notes, directions and boneyard are left out.
   * @param options Set `keepDirections` to keep `[[direction: ...]]` notes (for a copy for the crew).
   */
  exportScript(options: ExportOptions = {}): string {
    return exportScreenplay(this.data.scripts[MAIN_SCRIPT] ?? '', options);
  }

  /**
   * Looks up a provider's manifest.
   * @param providerId Provider id.
   * @throws {Error} When no such provider is registered.
   */
  private manifest(providerId: string): ProviderManifest {
    const definition = this.registry.get(providerId);
    if (!definition) throw new Error(`Unknown provider "${providerId}"`);
    return definition.manifest;
  }

  /** A seed for a new take. */
  private newSeed(): number {
    return Math.floor((this.options.random?.() ?? Math.random()) * 2 ** 31);
  }

  /** What the shot actions need from this service. */
  private context(): ActionContext {
    return {
      data: this.data,
      production: this.production,
      manifest: (providerId) => this.manifest(providerId),
      providerId: this.options.providerId ?? 'mock',
      newSeed: () => this.newSeed(),
    };
  }

  /** Brings the in-memory project in line with the queue, then returns the state. */
  private async refreshed(): Promise<StudioState> {
    await this.syncRuntime();
    return this.state();
  }

  /** Called by the queue after every job change: refresh, then tell the listeners. */
  private queueChanged(): void {
    void this.serialize(() => this.syncRuntime()).then(() => {
      for (const listener of this.listeners) listener();
    });
  }

  /**
   * Merges the queue's jobs and their stored results into the in-memory project. Jobs the queue does not know (sample
   * footage) are kept. The queue writes its own files; this only keeps memory current so a later save is consistent.
   */
  private async syncRuntime(): Promise<void> {
    const jobs = new Map<string, ProjectData['jobs'][number]>(
      this.data.jobs.map((job) => [job.id, job]),
    );
    const queued = this.production.jobs();
    for (const job of queued) jobs.set(job.id, job);
    const artifacts = new Map<string, ProjectData['artifacts'][number]>(
      this.data.artifacts.map((artifact) => [artifact.id, artifact]),
    );
    for (const artifact of await this.production.artifactsOf(queued))
      artifacts.set(artifact.id, artifact);
    this.data = {
      ...this.data,
      jobs: [...jobs.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
      artifacts: [...artifacts.values()],
    };
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
