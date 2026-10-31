import { z } from 'zod';
import { idSchema } from './common';

/** Where the local workspace state lives. It belongs to one person on one computer and is not part of the film. */
export const WORKSPACE_FILE = '.tapestry/workspace.json';

/**
 * What the app remembers about how you were working, so it can put you back where you left off. Separate from the
 * project proper: leave `.tapestry/` out of version control and sharing.
 */
export const WorkspaceSchema = z.strictObject({
  /** The scene being worked on; other sections (such as Shots) open on it too. */
  activeSceneId: idSchema('scn').optional(),
  /** Cursor position in the screenplay text. */
  cursor: z.int().nonnegative().optional(),
  /** Names of the acts that are folded away in the scene list. */
  collapsedActs: z.array(z.string()),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
