import type { Capability } from '@tapestry/core';
import type { Provider, ProviderConfig, ProviderDefinition, ProviderManifest } from './types';

/**
 * Lists problems with a provider configuration: missing required fields and values of the wrong type.
 * @param manifest The provider's manifest, which declares the fields.
 * @param config Values supplied by the user.
 * @returns Plain-language problems; empty when the configuration is usable.
 */
export function validateConfig(manifest: ProviderManifest, config: ProviderConfig): string[] {
  const problems: string[] = [];
  for (const [name, field] of Object.entries(manifest.config)) {
    const value = config[name];
    if (value === undefined || value === '') {
      if (field.required) problems.push(`${field.label} is required`);
      continue;
    }
    const expected =
      field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string';
    if (typeof value !== expected) problems.push(`${field.label} must be a ${expected}`);
  }
  return problems;
}

/** Known providers by id. Built-in providers and user plug-ins register here. */
export class ProviderRegistry {
  /** Definitions by provider id. */
  private readonly definitions = new Map<string, ProviderDefinition>();

  /**
   * Adds a provider.
   * @param definition The provider to add.
   * @throws {Error} When a provider with the same id is already registered.
   */
  register(definition: ProviderDefinition): void {
    const { id } = definition.manifest;
    if (this.definitions.has(id)) throw new Error(`Provider "${id}" is already registered`);
    this.definitions.set(id, definition);
  }

  /**
   * Looks up a provider.
   * @param id Provider id.
   */
  get(id: string): ProviderDefinition | undefined {
    return this.definitions.get(id);
  }

  /** All registered providers, sorted by id. */
  list(): ProviderDefinition[] {
    return [...this.definitions.values()].sort((a, b) => (a.manifest.id < b.manifest.id ? -1 : 1));
  }

  /**
   * Providers that can do a given kind of work.
   * @param capability The capability needed.
   */
  withCapability(capability: Capability): ProviderDefinition[] {
    return this.list().filter((d) => d.manifest.capabilities.includes(capability));
  }

  /**
   * Creates a provider instance after validating its configuration.
   * @param id Provider id.
   * @param config User-provided configuration.
   * @throws {Error} When the provider is unknown or the configuration is invalid.
   */
  create(id: string, config: ProviderConfig = {}): Provider {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown provider "${id}"`);
    const problems = validateConfig(definition.manifest, config);
    if (problems.length > 0) throw new Error(`${definition.manifest.name}: ${problems.join('; ')}`);
    return definition.create(config);
  }
}
