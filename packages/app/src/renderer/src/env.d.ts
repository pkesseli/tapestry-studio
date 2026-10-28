/// <reference types="vite/client" />
import type { TapestryApi } from '../../shared/api';

declare global {
  interface Window {
    /** API exposed by the preload script. */
    tapestry: TapestryApi;
  }
}
