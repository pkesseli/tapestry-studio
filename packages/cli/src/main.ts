import { ProjectFormatError, loadProject } from '@tapestry/core';
import type { Budget } from '@tapestry/core';
import { NodeFs } from '@tapestry/fs-node';
import { ProviderRegistry, mockProviderDefinition } from '@tapestry/providers';
import { JobQueue, QueueError } from '@tapestry/queue';
import type { CliIo } from './cli-io';
import { addDemoFootage } from './demo-footage';

export type { CliIo } from './cli-io';

/** Text printed by `tapestry help`. */
const USAGE = `Usage: tapestry <command>

Commands:
  queue run <project-folder>   Run every queued job of a project until none is left.
  demo-footage <project-folder> <clips-folder>
                               Give a project's scenes sample footage (close the app first).
  help                         Show this text.

Environment:
  TAPESTRY_BUDGET_CAP   Maximum spend (in the project's currency) for this run. Without it, headless runs refuse
                        providers that can cost money.`;

/**
 * Works out the spending limits for a headless run. The project's own budget only applies together with an explicit
 * `TAPESTRY_BUDGET_CAP`; without it no budget exists, so providers that can cost money are refused.
 * @param projectBudget Budget stored in the project, if any.
 * @param cap Value of `TAPESTRY_BUDGET_CAP`, if set.
 * @throws {QueueError} When the variable is not a non-negative number.
 */
export function headlessBudget(
  projectBudget: Budget | undefined,
  cap: string | undefined,
): Budget | undefined {
  if (cap === undefined || cap === '') return undefined;
  const limit = Number(cap);
  if (!Number.isFinite(limit) || limit < 0)
    throw new QueueError('TAPESTRY_BUDGET_CAP must be a non-negative number');
  return {
    currency: projectBudget?.currency ?? 'USD',
    projectCap: Math.min(projectBudget?.projectCap ?? limit, limit),
    perApprovalCap: Math.min(projectBudget?.perApprovalCap ?? limit, limit),
  };
}

/**
 * Runs the command line.
 * @param args Arguments after the program name.
 * @param io Output and environment.
 * @returns The process exit code: 0 on success, 1 when jobs failed, 2 for usage or project errors.
 */
export async function main(args: string[], io: CliIo): Promise<number> {
  const [command, subcommand, folder] = args;
  if (command === 'queue' && subcommand === 'run' && folder) return runQueue(folder, io);
  if (command === 'demo-footage' && subcommand && folder)
    return addDemoFootage(subcommand, folder, io);
  io.out(USAGE);
  return command === undefined || command === 'help' ? 0 : 2;
}

/**
 * Implements `queue run`.
 * @param folder Project folder.
 * @param io Output and environment.
 */
async function runQueue(folder: string, io: CliIo): Promise<number> {
  try {
    const fs = new NodeFs(folder);
    const { project } = await loadProject(fs);
    const registry = new ProviderRegistry();
    registry.register(mockProviderDefinition);
    const queue = await JobQueue.open({
      fs,
      registry,
      budget: headlessBudget(project.budget, io.env['TAPESTRY_BUDGET_CAP']),
      pollIntervalMs: 100,
    });
    queue.subscribe((event) => {
      if (event.type === 'job-changed') io.out(`${event.job.id}: ${event.job.state}`);
    });
    await queue.runUntilIdle();
    const jobs = queue.list();
    const failed = jobs.filter((job) => job.state === 'failed');
    io.out(`Done: ${jobs.length} job(s), ${failed.length} failed.`);
    for (const job of failed) io.err(`${job.id}: ${job.error?.message ?? 'failed'}`);
    return failed.length > 0 ? 1 : 0;
  } catch (error) {
    if (error instanceof ProjectFormatError || error instanceof QueueError) {
      io.err(error.message);
      return 2;
    }
    throw error;
  }
}
