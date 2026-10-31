import { hashJson, newId, sha256Hex } from '@tapestry/core';
import type { Artifact, Job, ProjectData, Scene } from '@tapestry/core';

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
}

/** A video file offered as sample footage. */
export interface SampleClip {
  /** File name, only used for the notes of the artifact. */
  name: string;
  bytes: Uint8Array;
}

/** What adding sample footage changes in a project. */
export interface FootagePlan {
  scenes: Scene[];
  jobs: Job[];
  artifacts: Artifact[];
  /** Video files to write, by project-relative path. */
  files: { path: string; bytes: Uint8Array }[];
}

/** States of a job whose result can be watched. */
const WATCHABLE = ['rendered', 'accepted', 'enhanced'];

/**
 * Finds the video that belongs to each shot of each scene (the newest watchable take).
 * @param data The project.
 */
export function clipsOf(data: ProjectData): SceneClip[] {
  const clips: SceneClip[] = [];
  for (const scene of data.scenes) {
    scene.shots.forEach((shot, index) => {
      const job = data.jobs
        .filter((j) => j.targetId === shot.id && WATCHABLE.includes(j.state))
        .at(-1);
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
      });
    });
  }
  return clips;
}

/**
 * Plans sample footage: scenes that have no shots yet get one to three shots (one per beat of the script), each with a
 * finished take. The first shot of every scene is accepted, the others are left ready to review, so the interface can
 * be tried with both states. Nothing is written; the caller stores the result.
 * @param data The project.
 * @param actionsByScene For each scene, the action text of its beats.
 * @param clips Videos to hand out in order, starting over when they run out.
 * @param now Time to record on the new jobs and artifacts.
 */
export async function planSampleFootage(
  data: ProjectData,
  actionsByScene: readonly (readonly string[])[],
  clips: readonly SampleClip[],
  now: Date = new Date(),
): Promise<FootagePlan> {
  const plan: FootagePlan = { scenes: [], jobs: [], artifacts: [], files: [] };
  if (clips.length === 0) return plan;
  const at = now.toISOString();
  let next = 0;
  for (const [sceneIndex, scene] of data.scenes.entries()) {
    if (scene.shots.length > 0) {
      plan.scenes.push(scene);
      continue;
    }
    const actions = actionsByScene[sceneIndex]?.filter(Boolean) ?? [];
    const shots: Scene['shots'] = [];
    for (const [shotIndex, action] of (actions.length > 0 ? actions : [scene.heading])
      .slice(0, 3)
      .entries()) {
      const clip = clips[next++ % clips.length] as SampleClip;
      const shot = {
        id: newId('sht'),
        action,
        dialogue: [],
        durationSeconds: 5,
        referenceEntityIds: [],
      };
      shots.push(shot);
      const accepted = shotIndex === 0;
      const request = {
        capability: 'video' as const,
        provider: { providerId: 'demo', model: 'demo-footage' },
        prompt: action,
        references: [],
        audioInputs: [],
        durationSeconds: 5,
        extras: {},
      };
      const artifactId = newId('art');
      const path = `artifacts/${artifactId}/clip.mp4`;
      plan.files.push({ path, bytes: clip.bytes });
      plan.artifacts.push({
        id: artifactId,
        jobId: newId('job'),
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
      const artifact = plan.artifacts[plan.artifacts.length - 1] as Artifact;
      plan.jobs.push({
        id: artifact.jobId,
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
    plan.scenes.push({ ...scene, shots });
  }
  return plan;
}
