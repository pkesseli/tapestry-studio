import { AliasIndex } from './aliases';
import type { ProjectData } from './storage';

/** A semantic problem in a project whose files are individually well-formed. */
export interface ProjectIssue {
  /** Where the problem is, for example `scenes/scn_…` or `timeline tln_…`. */
  where: string;
  message: string;
}

/**
 * Checks relationships that the per-file schemas cannot: dangling references, ambiguous aliases, and timeline clips
 * that point at artifacts that are not accepted.
 * @param data A loaded or about-to-be-saved project.
 * @returns All problems found; empty when the project is consistent.
 */
export function validateProject(data: ProjectData): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const problem = (where: string, message: string): number => issues.push({ where, message });
  const entityIds = new Set<string>(data.entities.map((e) => e.id));
  const artifactsById = new Map(data.artifacts.map((a) => [a.id, a]));
  const jobIds = new Set<string>(data.jobs.map((j) => j.id));
  const requireEntity = (where: string, id: string): void => {
    if (!entityIds.has(id)) problem(where, `Unknown entity ${id}`);
  };

  const allIds = [
    ...data.entities,
    ...data.scenes,
    ...data.sections,
    ...data.jobs,
    ...data.artifacts,
  ].map((x) => x.id);
  for (const id of allIds.filter((id, index) => allIds.indexOf(id) !== index))
    problem(id, 'Duplicate id');

  for (const entity of data.entities) {
    const paths = new Set(entity.references.map((r) => r.path));
    for (const path of entity.canonicalSheet) {
      if (!paths.has(path))
        problem(entity.id, `Canonical sheet file ${path} is not among the references`);
    }
    if (entity.kind === 'character' && entity.voiceId) requireEntity(entity.id, entity.voiceId);
  }
  for (const { alias, entities } of new AliasIndex(data.entities).conflicts()) {
    problem(alias, `Alias is used by several entities: ${entities.map((e) => e.id).join(', ')}`);
  }
  for (const scene of data.scenes) {
    if (scene.locationId) requireEntity(scene.id, scene.locationId);
    scene.entityIds.forEach((id) => requireEntity(scene.id, id));
    for (const shot of scene.shots) {
      shot.referenceEntityIds.forEach((id) => requireEntity(shot.id, id));
      for (const line of shot.dialogue) {
        requireEntity(line.id, line.speakerId);
        if (line.voiceId) requireEntity(line.id, line.voiceId);
      }
    }
  }
  for (const section of data.sections) {
    section.tracks.forEach((track) => requireEntity(section.id, track.instrumentId));
    section.lyrics.forEach((line) => line.voiceId && requireEntity(section.id, line.voiceId));
  }
  for (const artifact of data.artifacts) {
    if (!jobIds.has(artifact.jobId)) problem(artifact.id, `Unknown job ${artifact.jobId}`);
    if (artifact.accepted && !artifact.acceptedAt)
      problem(artifact.id, 'Accepted artifact has no acceptedAt');
    if (artifact.enhancedFromId && !artifactsById.has(artifact.enhancedFromId)) {
      problem(artifact.id, `Unknown source artifact ${artifact.enhancedFromId}`);
    }
  }
  for (const job of data.jobs) {
    for (const id of job.artifactIds)
      if (!artifactsById.has(id)) problem(job.id, `Unknown artifact ${id}`);
  }
  for (const timeline of data.timelines) {
    for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
      const artifact = artifactsById.get(clip.artifactId);
      if (!artifact) problem(clip.id, `Unknown artifact ${clip.artifactId}`);
      else if (!artifact.accepted) problem(clip.id, `Artifact ${clip.artifactId} is not accepted`);
      if (clip.outSeconds <= clip.inSeconds)
        problem(clip.id, 'Clip out point must be after its in point');
    }
  }
  return issues;
}
