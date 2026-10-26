import type { GenerationRequest, MediaType, RequestReference } from '@tapestry/core';
import type { ProviderLimits, ProviderManifest } from './types';

/** Importance of each reference role when not everything fits; earlier means kept first. */
const ROLE_PRIORITY = [
  'face',
  'body',
  'outfit',
  'place',
  'prop',
  'style',
  'mood',
  'voice-sample',
  'instrument-sample',
  'other',
] as const;

/** Result of choosing references within a provider's limits. */
export interface ReferenceSelection {
  /** References to send, most important first. */
  selected: RequestReference[];
  /** References left out, with the reason, so the UI can tell the user. */
  dropped: { reference: RequestReference; reason: string }[];
}

/**
 * Picks the references that fit a provider's limits, keeping the most important roles. Ties keep the caller's order,
 * so callers can put preferred references first.
 * @param candidates All references the composer would like to send.
 * @param limits The provider's limits for the capability being used.
 */
export function selectReferences(
  candidates: readonly RequestReference[],
  limits: ProviderLimits,
): ReferenceSelection {
  const perType: Record<MediaType, number | undefined> = {
    image: limits.maxImageReferences,
    video: limits.maxVideoReferences,
    audio: limits.maxAudioReferences,
  };
  const ranked = candidates
    .map((reference, index) => ({ reference, index }))
    .sort((a, b) => rank(a.reference) - rank(b.reference) || a.index - b.index);
  const used: Record<MediaType, number> = { image: 0, video: 0, audio: 0 };
  const selected: RequestReference[] = [];
  const dropped: ReferenceSelection['dropped'] = [];
  for (const { reference } of ranked) {
    const typeLimit = perType[reference.mediaType];
    if (typeLimit !== undefined && used[reference.mediaType] >= typeLimit) {
      dropped.push({
        reference,
        reason: `Only ${typeLimit} ${reference.mediaType} reference(s) allowed`,
      });
    } else if (
      limits.maxTotalReferences !== undefined &&
      selected.length >= limits.maxTotalReferences
    ) {
      dropped.push({
        reference,
        reason: `Only ${limits.maxTotalReferences} references allowed in total`,
      });
    } else {
      used[reference.mediaType]++;
      selected.push(reference);
    }
  }
  return { selected, dropped };
}

/**
 * Position of a reference's role in the priority order (unknown roles rank last).
 * @param reference Reference to rank.
 */
function rank(reference: RequestReference): number {
  const position = ROLE_PRIORITY.indexOf(reference.role as (typeof ROLE_PRIORITY)[number]);
  return position < 0 ? ROLE_PRIORITY.length : position;
}

/**
 * Checks a request against a provider's declared limits without any network access.
 * @param request The request to check.
 * @param manifest The provider's manifest.
 * @returns A plain-language reason when the request cannot run, or `undefined` when it fits.
 */
export function checkRequestLimits(
  request: GenerationRequest,
  manifest: ProviderManifest,
): string | undefined {
  if (!manifest.capabilities.includes(request.capability)) {
    return `${manifest.name} cannot do ${request.capability}`;
  }
  const limits = manifest.limits[request.capability] ?? {};
  if (
    limits.maxDurationSeconds !== undefined &&
    request.durationSeconds !== undefined &&
    request.durationSeconds > limits.maxDurationSeconds
  ) {
    return `${manifest.name} can make at most ${limits.maxDurationSeconds} seconds per clip`;
  }
  const { dropped } = selectReferences(request.references, limits);
  if (dropped.length > 0)
    return `Too many references for ${manifest.name}: ${dropped[0]?.reason ?? ''}`;
  if (limits.maxAudioInputs !== undefined && request.audioInputs.length > limits.maxAudioInputs) {
    return `${manifest.name} accepts at most ${limits.maxAudioInputs} audio input(s)`;
  }
  return undefined;
}
