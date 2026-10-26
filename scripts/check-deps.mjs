import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Allowed internal dependencies per package (one-way graph from doc/readme/architecture.md). A package absent from
 * this map is itself a violation, so new packages must be added deliberately.
 */
export const ALLOWED_INTERNAL = {
  core: [],
  script: ['core'],
  queue: ['core', 'providers'],
  providers: ['core'],
  media: ['core'],
  'fs-node': ['core'],
  cli: ['core', 'queue', 'providers', 'media', 'script', 'fs-node'],
  app: ['core', 'queue', 'providers', 'media', 'script', 'fs-node'],
};

/** Packages that must stay free of Node.js and Electron imports so they run anywhere and test instantly. */
export const PURE_PACKAGES = ['core', 'script'];

/** Matches the module specifier of an import/export-from/dynamic import statement. */
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * Checks one package against the dependency rules.
 * @param {string} name Package folder name (without the `@tapestry/` scope).
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} manifest Parsed package.json.
 * @param {Record<string, string>} sources Map of source file path to contents.
 * @returns {string[]} Human-readable violations; empty when the package is fine.
 */
export function checkPackage(name, manifest, sources) {
  const allowed = ALLOWED_INTERNAL[name];
  if (!allowed) return [`${name}: package is not listed in ALLOWED_INTERNAL`];
  const violations = [];
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  for (const dependency of declared.filter((d) => d.startsWith('@tapestry/'))) {
    if (!allowed.includes(dependency.slice('@tapestry/'.length))) {
      violations.push(`${name}: may not depend on ${dependency}`);
    }
  }
  for (const [file, text] of Object.entries(sources)) {
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? '';
      if (specifier.startsWith('@tapestry/') && !allowed.includes(specifier.split('/')[1] ?? '')) {
        violations.push(`${file}: imports ${specifier}, which ${name} may not depend on`);
      }
      const forbidden = specifier.startsWith('node:') || specifier === 'electron';
      if (PURE_PACKAGES.includes(name) && forbidden) {
        violations.push(`${file}: ${name} must not import ${specifier}`);
      }
    }
  }
  return violations;
}

/**
 * Reads all source files below a directory.
 * @param {string} directory Directory to scan recursively.
 * @returns {Record<string, string>} Map of file path to contents.
 */
function readSources(directory) {
  /** @type {Record<string, string>} */
  const result = {};
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) Object.assign(result, readSources(path));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) result[path] = readFileSync(path, 'utf8');
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packagesDirectory = fileURLToPath(new URL('../packages', import.meta.url));
  const violations = readdirSync(packagesDirectory).flatMap((name) => {
    const manifestPath = join(packagesDirectory, name, 'package.json');
    if (!existsSync(manifestPath)) return [];
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return checkPackage(name, manifest, readSources(join(packagesDirectory, name, 'src')));
  });
  for (const violation of violations) console.error(violation);
  process.exit(violations.length > 0 ? 1 : 0);
}
