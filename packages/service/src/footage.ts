import { hashJson, newId, sha256Hex } from '@tapestry/core';
import type { Artifact, Job, JobState, ProjectData, Quality } from '@tapestry/core';

/** Providers whose output is placeholder footage, not the user's film. Their clips always carry a "Sample" tag. */
export const SAMPLE_PROVIDER_IDS: readonly string[] = ['mock', 'demo'];

/** A video made for one shot of a scene, as the interface needs it. */
export interface SceneClip {
  sceneId: string;
  shotId: string;
  /** Position of the shot in its scene, starting at 1. */
  shotNumber: number;
  artifactId: string;
  /** Project-relative path of the video file. */
  path: string;
  /** True once the take has been accepted (frozen). */
  accepted: boolean;
  /** True for practice-mode and demo footage. */
  sample: boolean;
  /** The tier the shown take was made at. */
  quality: Quality;
}

/** One attempt at a shot (a job), as the shot panel lists it. */
export interface ShotTake {
  jobId: string;
  shotId: string;
  quality: Quality;
  state: JobState;
  /** True once the take has been accepted (frozen). */
  accepted: boolean;
  sample: boolean;
  /** Project-relative path of the video, once there is one. */
  path?: string;
  seed?: number;
  /** On a final: the draft job it follows. */
  sourceJobId?: string;
  /** Why a failed take failed. */
  error?: string;
  createdAt: string;
}

/** A video file offered as sample footage. */
export interface SampleClip {
  /** File name, only used for the notes of the artifact. */
  name: string;
  bytes: Uint8Array;
}

/** What adding sample footage changes in a project. */
export interface FootagePlan {
  jobs: Job[];
  artifacts: Artifact[];
  /** Video files to write, by project-relative path. */
  files: { path: string; bytes: Uint8Array }[];
}

/** States of a job whose result can be watched. */
const WATCHABLE = ['rendered', 'accepted', 'enhanced'];

/** How many shots of each scene receive sample footage. */
const SHOTS_PER_SCENE = 3;

/**
 * The tier a job was made at; jobs from before tiers existed are direct renders.
 * @param job The job.
 */
const qualityOf = (job: Job): Quality => job.request.quality ?? 'final';

/**
 * Lists every attempt at every shot, oldest first: queued, running, failed and finished ones alike.
 * @param data The project.
 */
export function takesOf(data: ProjectData): ShotTake[] {
  const shotIds = new Set(
    data.scenes.flatMap((scene) => scene.shots.map((shot) => shot.id as string)),
  );
  return data.jobs
    .filter((job) => job.targetId !== undefined && shotIds.has(job.targetId))
    .map((job) => {
      const artifact = data.artifacts.find((a) => job.artifactIds.includes(a.id));
      // Rejected takes keep their files, so they stay watchable for comparing with the take that replaced them.
      const file = artifact?.files.find((f) => f.mediaType === 'video');
      return {
        jobId: job.id,
        shotId: job.targetId as string,
        quality: qualityOf(job),
        state: job.state,
        accepted: job.state === 'accepted' || job.state === 'enhanced',
        sample: SAMPLE_PROVIDER_IDS.includes(job.request.provider.providerId),
        ...(file && { path: file.path }),
        ...(job.request.seed !== undefined && { seed: job.request.seed }),
        ...(job.sourceJobId !== undefined && { sourceJobId: job.sourceJobId }),
        ...(job.error && { error: job.error.message }),
        createdAt: job.createdAt,
      };
    });
}

/**
 * Finds the video that belongs to each shot of each scene: the newest watchable final if there is one, otherwise the
 * newest watchable draft.
 * @param data The project.
 */
export function clipsOf(data: ProjectData): SceneClip[] {
  const clips: SceneClip[] = [];
  for (const scene of data.scenes) {
    scene.shots.forEach((shot, index) => {
      const watchable = data.jobs.filter(
        (j) => j.targetId === shot.id && WATCHABLE.includes(j.state),
      );
      const job = watchable.filter((j) => qualityOf(j) === 'final').at(-1) ?? watchable.at(-1);
      const artifact = data.artifacts.find((a) => job?.artifactIds.includes(a.id));
      const file = artifact?.files.find((f) => f.mediaType === 'video');
      if (!job || !artifact || !file) return;
      clips.push({
        sceneId: scene.id,
        shotId: shot.id,
        shotNumber: index + 1,
        artifactId: artifact.id,
        path: file.path,
        accepted: job.state === 'accepted' || job.state === 'enhanced',
        sample: SAMPLE_PROVIDER_IDS.includes(artifact.provenance.providerId),
        quality: qualityOf(job),
      });
    });
  }
  return clips;
}

/**
 * Plans sample footage: the first shots of every scene that have no video yet get a finished take. The scene's first
 * shot is accepted, the others are left ready to review, so the interface can be tried with both states. Nothing is
 * written; the caller stores the result.
 * @param data The project, with its shots already derived from the script.
 * @param clips Videos to hand out in order, starting over when they run out.
 * @param now Time to record on the new jobs and artifacts.
 */
export async function planSampleFootage(
  data: ProjectData,
  clips: readonly SampleClip[],
  now: Date = new Date(),
): Promise<FootagePlan> {
  const plan: FootagePlan = { jobs: [], artifacts: [], files: [] };
  if (clips.length === 0) return plan;
  const at = now.toISOString();
  const watched = new Set(clipsOf(data).map((clip) => clip.shotId));
  let next = 0;
  for (const scene of data.scenes) {
    for (const shot of scene.shots.slice(0, SHOTS_PER_SCENE)) {
      if (watched.has(shot.id)) continue;
      const clip = clips[next++ % clips.length] as SampleClip;
      const accepted = shot.id === scene.shots[0]?.id;
      const request = {
        capability: 'video' as const,
        provider: { providerId: 'demo', model: 'demo-footage' },
        prompt: shot.action,
        references: [],
        audioInputs: [],
        durationSeconds: shot.durationSeconds,
        extras: {},
      };
      const artifactId = newId('art');
      const jobId = newId('job');
      const path = `artifacts/${artifactId}/clip.mp4`;
      plan.files.push({ path, bytes: clip.bytes });
      plan.artifacts.push({
        id: artifactId,
        jobId,
        files: [{ path, mediaType: 'video', contentHash: await sha256Hex(clip.bytes) }],
        accepted,
        ...(accepted && { acceptedAt: at }),
        provenance: {
          providerId: 'demo',
          model: 'demo-footage',
          inputsHash: await hashJson(request),
          referencePaths: [],
        },
        notes: `Sample footage (${clip.name}) for trying the interface`,
        createdAt: at,
      });
      plan.jobs.push({
        id: jobId,
        state: accepted ? 'accepted' : 'rendered',
        request,
        targetId: shot.id,
        estimate: { cost: 0, seconds: 0, notes: 'Sample footage' },
        actualCost: 0,
        artifactIds: [artifactId],
        history: [
          { at, to: 'draft', actor: 'system' },
          { at, from: 'draft', to: 'rendered', actor: 'system', note: 'Sample footage' },
          ...(accepted
            ? [{ at, from: 'rendered' as const, to: 'accepted' as const, actor: 'user' as const }]
            : []),
        ],
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  return plan;
}
