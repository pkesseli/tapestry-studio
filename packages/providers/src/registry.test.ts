import { expect, test } from 'vitest';
import { mockProviderDefinition } from './mock/mock-provider';
import { ProviderRegistry, validateConfig } from './registry';
import type { ProviderDefinition } from './types';

/** A provider that needs an API key. */
const keyed: ProviderDefinition = {
  manifest: {
    ...mockProviderDefinition.manifest,
    id: 'keyed',
    name: 'Keyed',
    capabilities: ['image'],
    config: {
      apiKey: { label: 'API key', type: 'secret', required: true },
      retries: { label: 'Retries', type: 'number', required: false },
    },
    paid: true,
    local: false,
  },
  create: (config) => ({ ...mockProviderDefinition.create(config), manifest: keyed.manifest }),
};

test('registers, lists and finds providers by capability', () => {
  const registry = new ProviderRegistry();
  registry.register(keyed);
  registry.register(mockProviderDefinition);
  expect(registry.list().map((d) => d.manifest.id)).toEqual(['keyed', 'mock']);
  expect(registry.withCapability('video').map((d) => d.manifest.id)).toEqual(['mock']);
  expect(registry.get('nope')).toBeUndefined();
});

test('refuses duplicate ids', () => {
  const registry = new ProviderRegistry();
  registry.register(mockProviderDefinition);
  expect(() => registry.register(mockProviderDefinition)).toThrow(/already registered/);
});

test('validates configuration before creating a provider', () => {
  const registry = new ProviderRegistry();
  registry.register(keyed);
  expect(() => registry.create('keyed', {})).toThrow(/API key is required/);
  expect(() => registry.create('keyed', { apiKey: 'k', retries: 'many' })).toThrow(
    /Retries must be a number/,
  );
  expect(registry.create('keyed', { apiKey: 'k' }).manifest.id).toBe('keyed');
  expect(() => registry.create('missing')).toThrow(/Unknown provider/);
});

test('reports no problems for a complete configuration', () => {
  expect(validateConfig(keyed.manifest, { apiKey: 'k', retries: 3 })).toEqual([]);
});
