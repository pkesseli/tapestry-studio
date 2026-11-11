#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRatingServer } from '../lib/server.mjs';

/** Port the rating page is served on. */
const PORT = Number(process.env.PORT ?? 4173);

const server = createRatingServer(join(dirname(fileURLToPath(import.meta.url)), '..'));
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Rating page: http://localhost:${PORT}/  (press Ctrl+C to stop)`);
  console.log('Ratings are saved to spikes/draft-final/results/ratings/<name>.json as you click.');
});
