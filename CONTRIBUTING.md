# Contributing

Thanks for helping! Tapestry Studio is Apache-2.0 and open to everyone.

- **Start with [AGENTS.md](AGENTS.md).** It explains how the repository is organised, how work is planned in
  `doc/plan/`, and what must be documented when a plan item is finished. It applies to people and AI agents alike.
- **Sign off your commits** (`git commit -s`) to certify the
  [Developer Certificate of Origin](https://developercertificate.org/). There is no CLA.
- **Clean-room rule:** do not copy code, structure or text from GPL/AGPL projects (for example AI Movie Studio 2).
  Ideas and feature lists are fine; implementations must be your own.
- **Before opening a pull request**, run `pnpm verify` (formatting, file-size and dependency checks, typecheck,
  lint, unit tests, build). CI runs it on Windows, macOS and Linux.
- Keep changes small and focused, with tests. Source files stay under 400 lines.

## Development setup

You need Node.js 24 or newer and pnpm 12 (the `packageManager` field in `package.json` pins the version).

```sh
pnpm install
pnpm dev          # start the Electron app with hot reload
pnpm verify       # everything CI runs, except the end-to-end test
pnpm test:e2e     # build and launch the real app with Playwright
```
