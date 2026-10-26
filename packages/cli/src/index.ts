#!/usr/bin/env node
/**
 * Headless command line entry point (`tapestry`). Agent loops and CI use it to exercise the same packages as the
 * desktop app without a UI. See `main.ts` for the commands.
 */
import { main } from './main';

process.exitCode = await main(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  env: process.env,
});
