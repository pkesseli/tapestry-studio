import { ArtifactSchema, artifactFile, fromZodError, stableStringify } from '@tapestry/core';
import type { Artifact, FsPort, Id } from '@tapestry/core';
import type { ProviderOutput } from '@tapestry/providers';
import { sha256Hex } from './hash';
import { QueueError } from './transitions';

/** Raised when something tries to change an accepted (frozen) artifact. */
export class FrozenArtifactError extends QueueError {
  /** @param id The frozen artifact. */
  constructor(id: string) {
    super(`Artifact ${id} is accepted and cannot be changed`);
    this.name = 'FrozenArtifactError';
  }
}

/**
 * Reads and writes artifacts, enforcing the freeze rule: once an artifact is accepted its files and metadata can only
 * be changed by an explicit un-accept (invariant 2 in doc/readme/architecture.md).
 */
export class ArtifactStore {
  /** @param fs File system rooted at the project folder. */
  constructor(private readonly fs: FsPort) {}

  /**
   * Loads an artifact record, or `undefined` when it does not exist.
   * @param id Artifact id.
   */
  async load(id: Id<'art'>): Promise<Artifact | undefined> {
    const path = artifactFile(id);
    if (!(await this.fs.exists(path))) return undefined;
    const parsed = ArtifactSchema.safeParse(JSON.parse(await this.fs.readText(path)));
    if (!parsed.success) throw fromZodError(path, parsed.error);
    return parsed.data;
  }

  /**
   * Throws when an artifact is frozen.
   * @param id Artifact id.
   * @throws {FrozenArtifactError} When the artifact exists and is accepted.
   */
  async assertWritable(id: Id<'art'>): Promise<void> {
    if ((await this.load(id))?.accepted) throw new FrozenArtifactError(id);
  }

  /**
   * Stores freshly generated files and the artifact record. Refuses if the artifact already exists and is frozen.
   * @param base The record without file hashes.
   * @param outputs Files produced by the provider.
   * @returns The stored artifact, with content hashes filled in.
   */
  async create(
    base: Omit<Artifact, 'files'>,
    outputs: readonly ProviderOutput[],
  ): Promise<Artifact> {
    await this.assertWritable(base.id);
    const files = await Promise.all(
      outputs.map(async (output) => {
        const path = `artifacts/${base.id}/${output.fileName}`;
        await this.fs.writeBytes(path, output.bytes);
        return { path, mediaType: output.mediaType, contentHash: await sha256Hex(output.bytes) };
      }),
    );
    const artifact: Artifact = { ...base, files };
    await this.save(artifact);
    return artifact;
  }

  /**
   * Freezes an artifact after checking that its files still match their recorded hashes.
   * @param id Artifact id.
   * @param at Timestamp to record as the acceptance time.
   * @throws {QueueError} When the artifact is missing or a file no longer matches its hash.
   */
  async freeze(id: Id<'art'>, at: string): Promise<Artifact> {
    const artifact = await this.require(id);
    const problem = await this.verify(artifact);
    if (problem) throw new QueueError(problem);
    const frozen: Artifact = { ...artifact, accepted: true, acceptedAt: at };
    await this.save(frozen);
    return frozen;
  }

  /**
   * Lifts the freeze after an explicit user action. The files stay where they are.
   * @param id Artifact id.
   */
  async unfreeze(id: Id<'art'>): Promise<Artifact> {
    const { acceptedAt: _removed, ...rest } = await this.require(id);
    const thawed: Artifact = { ...rest, accepted: false };
    await this.save(thawed);
    return thawed;
  }

  /**
   * Checks every file of an artifact against its recorded hash.
   * @param artifact The artifact to check.
   * @returns A description of the first mismatch, or `undefined` when all files are intact.
   */
  async verify(artifact: Artifact): Promise<string | undefined> {
    for (const file of artifact.files) {
      if (!(await this.fs.exists(file.path))) return `${file.path} is missing`;
      if ((await sha256Hex(await this.fs.readBytes(file.path))) !== file.contentHash) {
        return `${file.path} changed after it was generated`;
      }
    }
    return undefined;
  }

  /**
   * Loads an artifact or throws.
   * @param id Artifact id.
   */
  private async require(id: Id<'art'>): Promise<Artifact> {
    const artifact = await this.load(id);
    if (!artifact) throw new QueueError(`Unknown artifact ${id}`);
    return artifact;
  }

  /**
   * Writes an artifact record after validating it.
   * @param artifact The record to write.
   */
  private async save(artifact: Artifact): Promise<void> {
    const path = artifactFile(artifact.id);
    const parsed = ArtifactSchema.safeParse(artifact);
    if (!parsed.success) throw fromZodError(path, parsed.error);
    await this.fs.writeText(path, stableStringify(parsed.data));
  }
}
