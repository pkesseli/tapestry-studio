# 01 — Repo scaffold

## Needs human
- Choose between electron-builder and Electron Forge for packaging (stack itself is decided: see `doc/readme/architecture.md`).
- Confirm GitHub repo name `tapestry-studio` is available; check trademark registries before the first public release.
- Provide the GitHub repo URL when ready (`git remote add origin ...`); do not push without being asked.

## Goal
A green, empty monorepo that enforces the project's rules from day one.

## Steps
1. pnpm workspace with packages: `core`, `queue`, `providers`, `media`, `script`, `app` (empty but building), plus `cli`.
2. TypeScript strict, shared tsconfig, ESLint + Prettier, vitest.
3. CI (GitHub Actions): install, typecheck, lint, test on macOS + Windows + Linux.
4. Custom check script `scripts/check-file-size` failing CI on source files > 400 lines; check that package
   dependency direction matches `architecture.md` (e.g. `core` imports nothing internal).
5. SPDX `Apache-2.0` header policy (no per-file headers required; `LICENSE` + package.json `license` fields).
6. Electron shell (main process + sandboxed React renderer with typed IPC, contextIsolation on) that opens the empty `app` window; document the dev commands in `README.md`.
7. `CONTRIBUTING.md` (short): points to `AGENTS.md`, DCO sign-off (no CLA), clean-room rule.
8. Add `.github/` issue templates (bug, model/provider request).

## Acceptance
- `pnpm install && pnpm test && pnpm build` pass locally and in CI on all three OSes.
- `pnpm dev` shows an empty Electron window; a Playwright smoke test launches the app and sees it.
- File-size and dependency-direction checks demonstrably fail on a deliberate violation (add a test for the checker).

## On completion
Move final dev-command list and CI facts to `README.md`; remove this file.
