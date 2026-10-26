import type { TapestryApi } from '../../preload';

declare global {
  interface Window {
    /** API exposed by the preload script. */
    tapestry: TapestryApi;
  }
}
