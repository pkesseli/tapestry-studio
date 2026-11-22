import { finalRequestFromDraft } from '@tapestry/core';
import type { Entity, Id, ProjectData, Quality } from '@tapestry/core';
import type { ProviderManifest } from '@tapestry/providers';
import { composeShot } from './compose';
import type { Production } from './production';

/** What the shot actions need from the service. */
export interface ActionContext {
  /** The project as it is now. */
  data: ProjectData;
  production: Production;
  /** Looks up a provider's manifest. @throws when there is no such provider. */
  manifest(providerId: string): ProviderManifest;
  /** Provider used for a new shot. */
  providerId: string;
  /** A seed for a new take. */
  newSeed(): number;
}

/**
 * Starts a take of a shot at the given quality: composes the request from the script, the cast and the provider's limits,
 * then queues it (it runs at once for a free provider).
 * @param context What the actions need.
 * @param shotId The shot.
 * @param quality `draft` or `final`.
 * @throws {Error} When the shot or provider does not exist or the request does not fit the provider.
 */
export async function startShot(
  context: ActionContext,
  shotId: string,
  quality: Quality,
): Promise<void> {
  const scene = context.data.scenes.find((s) => s.shots.some((shot) => shot.id === shotId));
  const shot = scene?.shots.find((candidate) => candidate.id === shotId);
  if (!scene || !shot) throw new Error('That shot does not exist any more');
  const manifest = context.manifest(context.providerId);
  const { request } = composeShot({
    scene,
    shot,
    entities: context.data.entities as readonly Entity[],
    manifest,
    quality,
    seed: context.newSeed(),
  });
  await context.production.start(request, manifest, { targetId: shotId });
}

/**
 * Starts the final of an accepted draft: a fresh render at final quality with the draft's prompt, references and seed.
 * @param context What the actions need.
 * @param draftJobId The accepted draft take.
 * @throws {Error} When the job is not an accepted draft with a seed.
 */
export async function startFinal(context: ActionContext, draftJobId: string): Promise<void> {
  const draft = context.production.queue.get(draftJobId as Id<'job'>);
  if (!draft) throw new Error('That take does not exist any more');
  const result = finalRequestFromDraft(draft);
  if (!result.ok) throw new Error(result.reason);
  await context.production.start(
    result.request,
    context.manifest(draft.request.provider.providerId),
    {
      targetId: draft.targetId ?? '',
      sourceJobId: result.sourceJobId,
    },
  );
}

/**
 * Accepts a finished take. A shot has at most one accepted take per quality, so another accepted take of the same shot
 * and quality has to be un-accepted first (an explicit decision, never an overwrite).
 * @param context What the actions need.
 * @param jobId The take.
 * @throws {Error} When another take of the same shot and quality is already accepted.
 */
export async function acceptOne(context: ActionContext, jobId: string): Promise<void> {
  const job = context.production.queue.get(jobId as Id<'job'>);
  if (!job) throw new Error('That take does not exist any more');
  const quality = job.request.quality ?? 'final';
  const other = context.production
    .jobs()
    .find(
      (j) =>
        j.id !== job.id &&
        j.targetId === job.targetId &&
        j.state === 'accepted' &&
        (j.request.quality ?? 'final') === quality,
    );
  if (other) throw new Error(`This shot already has an accepted ${quality} take`);
  await context.production.accept(job.id);
}

/**
 * Rejects a finished take and starts another attempt at the same shot with a new seed. The rejected files stay.
 * @param context What the actions need.
 * @param jobId The take to replace.
 */
export async function startAnother(context: ActionContext, jobId: string): Promise<void> {
  const job = context.production.queue.get(jobId as Id<'job'>);
  if (!job) throw new Error('That take does not exist any more');
  await context.production.another(job.id, context.manifest(job.request.provider.providerId));
}
