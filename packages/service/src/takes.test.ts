import { buildSampleFilm, sampleId } from '@tapestry/core/testing';
import type { ProjectData } from '@tapestry/core';
import { expect, test } from 'vitest';
import { clipsOf, takesOf } from './footage';

/**
 * The sample film with a second job for the same shot: a final that follows the first job (made a draft and accepted).
 * The film's own job is an accepted direct render, so here it plays the part of the draft.
 */
function withFinal(): ProjectData {
  const film = buildSampleFilm();
  const [draftJob] = film.jobs;
  const [draftArtifact] = film.artifacts;
  if (!draftJob || !draftArtifact) throw new Error('sample data changed');
  const finalArtifactId = sampleId('art', 2);
  const finalJobId = sampleId('job', 2);
  film.jobs = [
    { ...draftJob, request: { ...draftJob.request, quality: 'draft' } },
    {
      ...draftJob,
      id: finalJobId,
      state: 'rendered',
      sourceJobId: draftJob.id,
      request: { ...draftJob.request, quality: 'final' },
      artifactIds: [finalArtifactId],
    },
  ];
  film.artifacts = [
    draftArtifact,
    {
      ...draftArtifact,
      id: finalArtifactId,
      jobId: finalJobId,
      accepted: false,
      files: [
        { ...(draftArtifact.files[0] as (typeof draftArtifact.files)[0]), path: 'final.mp4' },
      ],
    },
  ];
  film.timelines = [];
  return film;
}

test('takes list every attempt with its tier, state, seed and the draft a final follows', () => {
  const takes = takesOf(withFinal());
  expect(takes.map((t) => [t.quality, t.state, t.accepted])).toEqual([
    ['draft', 'accepted', true],
    ['final', 'rendered', false],
  ]);
  expect(takes[1]).toMatchObject({ sourceJobId: takes[0]?.jobId, seed: 7, path: 'final.mp4' });
});

test('the footage shown for a shot is the newest final, and falls back to the draft', () => {
  const both = withFinal();
  expect(clipsOf(both)[0]).toMatchObject({ quality: 'final', path: 'final.mp4', accepted: false });
  const onlyDraft = { ...both, jobs: [both.jobs[0] as (typeof both.jobs)[0]] };
  expect(clipsOf(onlyDraft)[0]).toMatchObject({ quality: 'draft', accepted: true });
});

test('jobs from before tiers existed count as final takes', () => {
  const film = buildSampleFilm();
  expect(takesOf(film)[0]?.quality).toBe('final');
  expect(clipsOf(film)[0]?.quality).toBe('final');
});

test('a failed take has no video and carries its reason', () => {
  const film = withFinal();
  const [draft, final] = film.jobs;
  if (!draft || !final) throw new Error('sample data changed');
  film.jobs = [
    draft,
    {
      ...final,
      state: 'failed',
      artifactIds: [],
      error: { message: 'Out of memory', retryable: true },
    },
  ];
  const take = takesOf(film)[1];
  expect(take).toMatchObject({ state: 'failed', error: 'Out of memory' });
  expect(take).not.toHaveProperty('path');
});
