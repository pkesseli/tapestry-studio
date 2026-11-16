import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from './csv.mjs';

/** Folder, relative to the served root, where rating packages from the Mac are extracted (git ignores it). */
export const INCOMING = 'incoming';

/** The only shape of package folder accepted by the save call. */
const PACKAGE_DIR = new RegExp(`^${INCOMING}/[A-Za-z0-9._-]+$`);

/** Largest ratings file accepted, in bytes. */
const MAX_CSV = 1024 * 1024;

/** Header of the ratings file, which the Mac session reads back. */
const HEADER = 'file,score_1_to_5,notes';

/**
 * Lists the folders under `incoming/` that hold a `ratings.csv`, with what the rating page needs to show them.
 * @param {string} root The served folder (`spikes/`).
 * @returns {{ dir: string, rows: number, howTo: boolean, sheets: string[] }[]} One entry per package. `sheets` are
 * pictures (outside `plan10/`) such as side-by-side comparison sheets, relative to the package folder.
 */
export function listPackages(root) {
  const base = join(root, INCOMING);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((name) => existsSync(join(base, name, 'ratings.csv')))
    .map((name) => {
      const folder = join(base, name);
      const sheets = readdirSync(folder)
        .filter((sub) => sub !== 'plan10' && statSync(join(folder, sub)).isDirectory())
        .flatMap((sub) =>
          readdirSync(join(folder, sub))
            .filter((file) => file.toLowerCase().endsWith('.png'))
            .map((file) => `${sub}/${file}`),
        );
      return {
        dir: `${INCOMING}/${name}`,
        rows: parseCsv(readFileSync(join(folder, 'ratings.csv'), 'utf8')).length - 1,
        howTo: existsSync(join(folder, 'HOW-TO-RATE.txt')),
        sheets,
      };
    });
}

/**
 * Saves a package's ratings file in place. The first save keeps the untouched original next to it as
 * `ratings.original.csv`. Only an existing package folder under `incoming/` can be written, and only its `ratings.csv`.
 * @param {string} root The served folder (`spikes/`).
 * @param {string} dir The package folder, for example `incoming/tapestry-rating-2-2026-11-16`.
 * @param {string} csv The new content; it must start with the usual header.
 * @throws {Error} When the folder is not a package or the content is not acceptable.
 */
export function savePackageCsv(root, dir, csv) {
  if (!PACKAGE_DIR.test(dir)) throw new Error('not a rating package folder');
  const file = join(root, dir, 'ratings.csv');
  if (!existsSync(file)) throw new Error('package has no ratings.csv');
  if (typeof csv !== 'string' || csv.length > MAX_CSV) throw new Error('ratings file too large');
  if (!csv.startsWith(HEADER)) throw new Error(`ratings file must start with ${HEADER}`);
  const original = join(root, dir, 'ratings.original.csv');
  if (!existsSync(original)) copyFileSync(file, original);
  writeFileSync(file, csv);
}
