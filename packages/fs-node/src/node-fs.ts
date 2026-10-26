import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { DirEntry, FsPort } from '@tapestry/core';

/** {@link FsPort} backed by a real folder on disk. Writes are atomic: temp file, then rename. */
export class NodeFs implements FsPort {
  /** Absolute path of the project folder. */
  private readonly root: string;

  /**
   * @param root Folder the project lives in; all paths given to the methods are relative to it.
   */
  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * Resolves a project-relative path to an absolute one, refusing anything that escapes the project folder.
   * @param path Project-relative path using `/` separators.
   * @throws {Error} When the path points outside the project folder.
   */
  private abs(path: string): string {
    const full = resolve(this.root, path);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Path escapes the project folder: ${path}`);
    }
    return full;
  }

  /** @inheritdoc */
  async readText(path: string): Promise<string> {
    return readFile(this.abs(path), 'utf8');
  }

  /** @inheritdoc */
  writeText(path: string, text: string): Promise<void> {
    return this.writeAtomically(path, text);
  }

  /** @inheritdoc */
  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.abs(path)));
  }

  /** @inheritdoc */
  writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    return this.writeAtomically(path, bytes);
  }

  /**
   * Writes a file via a temporary sibling and a rename, so readers never see partial contents.
   * @param path Project-relative file path.
   * @param data Text (written as UTF-8) or bytes.
   */
  private async writeAtomically(path: string, data: string | Uint8Array): Promise<void> {
    const target = this.abs(path);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await writeFile(temporary, data);
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  /** @inheritdoc */
  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.abs(path));
      return true;
    } catch {
      return false;
    }
  }

  /** @inheritdoc */
  async list(directory: string): Promise<DirEntry[]> {
    try {
      const entries = await readdir(this.abs(directory), { withFileTypes: true });
      return entries
        .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  /** @inheritdoc */
  async remove(path: string): Promise<void> {
    await rm(this.abs(path), { force: true });
  }
}
