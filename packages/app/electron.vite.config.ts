import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

/** Workspace packages ship TypeScript sources, so they are bundled instead of externalized. */
const WORKSPACE_PACKAGES = ['core', 'queue', 'providers', 'media', 'script'].map(
  (name) => `@tapestry/${name}`,
);

/** Build configuration for the Electron main process, preload script and React renderer. */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
  },
});
