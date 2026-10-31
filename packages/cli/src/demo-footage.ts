import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeFs } from '@tapestry/fs-node';
import { ProjectService } from '@tapestry/service';
import type { CliIo } from './cli-io';

/**
 * Gives the scenes of a project sample footage, so the interface can be explored with videos before real generation
 * exists. Creates the project (with the example screenplay) when the folder holds none. Close the app first: it keeps
 * its own copy of the project and would overwrite the change.
 * @param projectFolder Project folder to add the footage to.
 * @param clipsFolder Folder with `.mp4` files, handed out in file-name order.
 * @param io Output.
 * @returns Process exit code.
 */
export async function addDemoFootage(
  projectFolder: string,
  clipsFolder: string,
  io: CliIo,
): Promise<number> {
  const names = (await readdir(clipsFolder))
    .filter((name) => name.toLowerCase().endsWith('.mp4'))
    .sort();
  if (names.length === 0) {
    io.err(`No .mp4 files found in ${clipsFolder}`);
    return 2;
  }
  const clips = await Promise.all(
    names.map(async (name) => ({
      name,
      bytes: new Uint8Array(await readFile(join(clipsFolder, name))),
    })),
  );
  const service = await ProjectService.open(new NodeFs(projectFolder));
  const state = await service.addSampleFootage(clips);
  const accepted = state.clips.filter((clip) => clip.accepted).length;
  io.out(
    `${projectFolder}: ${state.clips.length} sample clip(s) in ${state.scenes.length} scene(s), ${accepted} accepted.`,
  );
  return 0;
}
