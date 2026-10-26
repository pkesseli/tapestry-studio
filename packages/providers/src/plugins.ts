import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PluginManifestSchema } from './types';
import type { Provider, ProviderConfig, ProviderDefinition } from './types';

/** A plug-in folder that could not be loaded, with the reason. */
export interface PluginFailure {
  directory: string;
  reason: string;
}

/** Outcome of scanning a plug-in folder. One broken plug-in never prevents the others from loading. */
export interface PluginScan {
  plugins: ProviderDefinition[];
  failures: PluginFailure[];
}

/**
 * Loads provider plug-ins from a folder. Each plug-in is a sub-folder with a `plugin.json` (the manifest plus an
 * `entry` path) and a JavaScript module whose default export is `(config) => Provider`.
 *
 * Plug-ins are code that runs with the app's permissions, so they are only ever loaded from a folder the user put
 * them in: no downloading, no auto-update.
 * @param directory Folder containing one sub-folder per plug-in; a missing folder yields an empty result.
 */
export async function loadPlugins(directory: string): Promise<PluginScan> {
  const result: PluginScan = { plugins: [], failures: [] };
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries.filter((e) => e.isDirectory())) {
    const folder = join(directory, entry.name);
    try {
      result.plugins.push(await loadPlugin(folder));
    } catch (error) {
      result.failures.push({ directory: folder, reason: (error as Error).message });
    }
  }
  return result;
}

/**
 * Loads one plug-in folder.
 * @param folder Absolute path of the plug-in folder.
 * @throws {Error} With a plain-language reason when the plug-in is invalid.
 */
async function loadPlugin(folder: string): Promise<ProviderDefinition> {
  const parsed = PluginManifestSchema.safeParse(
    JSON.parse(await readFile(join(folder, 'plugin.json'), 'utf8')),
  );
  if (!parsed.success) {
    throw new Error(
      `Invalid plugin.json: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const { entry, ...manifest } = parsed.data;
  const entryPath = resolve(folder, entry);
  if (!entryPath.startsWith(resolve(folder) + sep))
    throw new Error('Plugin entry must be inside its folder');
  const module = (await import(/* @vite-ignore */ pathToFileURL(entryPath).href)) as {
    default?: (config: ProviderConfig) => Provider;
  };
  if (typeof module.default !== 'function')
    throw new Error('Plugin entry must export a default function');
  const create = module.default;
  return { manifest, create };
}
