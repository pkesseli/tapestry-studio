import { defineConfig } from '@playwright/test';

/** End-to-end tests launch the built Electron app (run `pnpm test:e2e`, which builds first). */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
});
