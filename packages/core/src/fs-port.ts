/** An entry of a directory listing. */
export interface DirEntry {
  /** File or directory name, without any parent path. */
  name: string;
  /** True for directories. */
  isDirectory: boolean;
}

/**
 * Minimal file system abstraction rooted at a project folder. All paths are project-relative, use `/` as separator,
 * and never start with `/` or contain `..`. Keeping I/O behind this port lets `core` stay free of Node imports.
 */
export interface FsPort {
  /**
   * Reads a UTF-8 text file; rejects when it does not exist.
   * @param path Project-relative file path.
   */
  readText(path: string): Promise<string>;
  /**
   * Writes a UTF-8 text file atomically (readers never see a half-written file), creating parent directories.
   * @param path Project-relative file path.
   * @param text Complete new contents.
   */
  writeText(path: string, text: string): Promise<void>;
  /**
   * Reads a binary file; rejects when it does not exist.
   * @param path Project-relative file path.
   */
  readBytes(path: string): Promise<Uint8Array>;
  /**
   * Writes a binary file atomically, creating parent directories.
   * @param path Project-relative file path.
   * @param bytes Complete new contents.
   */
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /**
   * Tells whether a file or directory exists.
   * @param path Project-relative path.
   */
  exists(path: string): Promise<boolean>;
  /**
   * Lists a directory, sorted by name. A missing directory yields an empty list.
   * @param directory Project-relative directory path (`''` for the project root).
   */
  list(directory: string): Promise<DirEntry[]>;
  /**
   * Deletes a file. Does nothing when it does not exist.
   * @param path Project-relative file path.
   */
  remove(path: string): Promise<void>;
}

/** Minimal view of the platform text encoder (available in Node, Electron and browsers). */
declare const TextEncoder: new () => { encode(text: string): Uint8Array };

/** Minimal view of the platform text decoder. */
declare const TextDecoder: new () => { decode(bytes: Uint8Array): string };

/** In-memory {@link FsPort} for tests and dry runs. */
export class MemoryFs implements FsPort {
  /** File contents by project-relative path. */
  private readonly store = new Map<string, Uint8Array>();

  /** Snapshot of all files decoded as UTF-8 text, sorted by path. */
  files(): Record<string, string> {
    const decoder = new TextDecoder();
    return Object.fromEntries(
      [...this.store]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([path, bytes]) => [path, decoder.decode(bytes)]),
    );
  }

  /** @inheritdoc */
  async readText(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readBytes(path));
  }

  /** @inheritdoc */
  writeText(path: string, text: string): Promise<void> {
    return this.writeBytes(path, new TextEncoder().encode(text));
  }

  /** @inheritdoc */
  readBytes(path: string): Promise<Uint8Array> {
    const bytes = this.store.get(path);
    return bytes === undefined
      ? Promise.reject(new Error(`ENOENT: ${path}`))
      : Promise.resolve(bytes.slice());
  }

  /** @inheritdoc */
  writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.store.set(path, bytes.slice());
    return Promise.resolve();
  }

  /** @inheritdoc */
  exists(path: string): Promise<boolean> {
    const prefix = `${path}/`;
    return Promise.resolve(
      this.store.has(path) || [...this.store.keys()].some((key) => key.startsWith(prefix)),
    );
  }

  /** @inheritdoc */
  list(directory: string): Promise<DirEntry[]> {
    const prefix = directory === '' ? '' : `${directory}/`;
    const entries = new Map<string, boolean>();
    for (const key of this.store.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf('/');
      const name = slash < 0 ? rest : rest.slice(0, slash);
      entries.set(name, entries.get(name) === true || slash >= 0);
    }
    const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : 1));
    return Promise.resolve(sorted.map(([name, isDirectory]) => ({ name, isDirectory })));
  }

  /** @inheritdoc */
  remove(path: string): Promise<void> {
    this.store.delete(path);
    return Promise.resolve();
  }
}
