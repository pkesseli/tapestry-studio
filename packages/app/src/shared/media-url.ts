/** URL scheme under which the main process serves media files of the open project, read-only. */
export const MEDIA_SCHEME = 'tapestry-media';

/**
 * URL for a media file of the open project.
 * @param path Project-relative path such as `artifacts/art_…/clip.mp4`.
 * @param atSeconds When given, makes the browser show the frame at that time as the still picture before playing.
 */
export function mediaUrl(path: string, atSeconds?: number): string {
  const base = `${MEDIA_SCHEME}://project/${path}`;
  return atSeconds === undefined ? base : `${base}#t=${atSeconds}`;
}
