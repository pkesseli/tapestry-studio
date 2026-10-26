# Architecture

Status: **decided, not yet implemented**. Keep this file true as plans land.

## Shape

Desktop app: **Electron** shell + **TypeScript/React** UI, installable on Windows, macOS and Linux (installers plus
package managers, see plan 19). Decided 2026-10 after comparing Tauri, Avalonia (C#), Flutter, Qt and Java. Reasons:
- Bundled Chromium gives identical video/audio/canvas behaviour on all three OSes (Tauri's Linux web view varies).
- Best accessibility tree of any UI stack; richest ready-made editor/waveform/timeline components.
- Playwright can drive the real app end to end, which agent loops depend on.
- One language (TypeScript) for contributors and agents; mature packaging and auto-update tooling.
Accepted costs: larger installer and somewhat higher idle RAM than native stacks. Avalonia was the runner-up; the
RAM/size difference was not measured (no reliable public numbers). Revisit only if measurements on the target
MacBook show memory pressure during local generation.

Vocabulary: the **shell** is the native wrapper (window, menus, file dialogs, keychain, notifications, spawning helper
programs, installer, updates). In Electron it is the **main process** (Node.js); the React UI runs in a sandboxed
**renderer** (Chromium) and reaches the machine only through a small, typed IPC surface exposed by the main process.

Python is **not** part of the app. It appears only as an optional, app-managed local engine (ComfyUI in a `uv`-created
venv, or a ComfyUI the user already runs) for local generation. Remote-only users never install it.

Monorepo (pnpm workspaces), packages with strict one-way dependencies:

```
core        pure TS: project format schemas, load/save, validation, migrations, ids. No I/O libs besides an fs port.
queue       job state machine, persistence, budgets, scheduling. Depends on core.
providers   Provider interface + built-in adapters (mock, comfyui, fal, replicate, ...). Depends on core.
media       ffmpeg wrapper (external binary), thumbnails, stitching, waveform. Depends on core.
fs-node     Node.js FsPort implementation (atomic disk writes). Depends on core.
script      screenplay/lyrics parsing, entity detection. Depends on core.
app         Electron main process + React renderer. Depends on all of the above.
```

Rule: `core` and `script` have no Node/Electron imports so they can be tested instantly and reused (CLI, tests).
A headless **CLI** (`tapestry run <project>`) uses the same packages; it is how agent loops and CI exercise the system
without the UI.

Local model execution is **out of process**: Tapestry Studio talks to ComfyUI (HTTP/WebSocket) or other local servers.
If a bespoke local runner is needed for Apple Silicon, it is a separate sidecar process behind the same Provider
interface (see plan 10).

## Client boundary and future mobile client

Business logic (project, queue, providers, composer) lives in UI-free packages, never in React components. Clients talk
to it through a narrow, typed, versioned API (in-process IPC today; an authenticated HTTP/WebSocket server later for
remote clients). A mobile client is expected to be a **bespoke, curated companion** (write, review, approve from the
queue), not a wrapped copy of the desktop UI, and local video generation on phones is out of scope. The API boundary
must therefore stay strict from the start; see `doc/plan/90-backlog.md`.

## Core flow

```
Script/lyrics text --(script pkg)--> entities + scenes/sections
Scenes + assets --(composer)--> GenerationRequest(s)   (references chosen within the model's reference budget)
GenerationRequest --> Job (queue) --> Provider --> Artifact file (+ metadata)
Artifact --review--> Accepted (frozen) | Redo
Accepted --> optional Enhance job --> Enhanced artifact (new file; original kept)
Accepted/Enhanced --> Timeline --> export (mp4/wav/OTIO)
```

## Job lifecycle (single source of truth: `queue` package)

```
Draft -> Approved -> Queued -> Running -> Rendered -> Accepted(frozen) -> Enhanced
              \         \          \         \-> Redo (creates a new Draft; old artifact kept)
               \         \          \-> Failed (retryable) 
                \         \-> Cancelled
                 \-> Cancelled
```

- **Approved** = user authorised spending/time; carries an estimate (cost, duration) and a hard cap.
- Jobs are idempotent records on disk; app restart resumes Queued/Running (re-polls remote provider job ids).
- Accepted artifacts are immutable (content-hash recorded). Enhancement writes a new artifact linked to the original.

## Music and film share the model

An **Entity** is anything the script can reference: Character, Location, Prop (film); Voice, Instrument (shared by film
dialogue/score and music). A **Scene** (film) and a **Section** (music: verse/chorus/bridge) are both "units that resolve
entities into a GenerationRequest". Providers declare capabilities (`video`, `image`, `speech`, `music`, `sfx`,
`upscale`...) so one queue serves all. Details: `project-format.md`, `providers.md`.

## Plugin system

Providers are discovered from built-in packages and from a user plugin folder. A plugin = manifest (id, capabilities,
config schema, license/terms URL, pricing hints) + implementation of the Provider interface. Config and API keys live in
the OS keychain (via Electron `safeStorage`), never in the project folder.

## Invariants (do not break)

1. Project folder is the source of truth; app caches are disposable.
2. Accepted artifacts are never overwritten or regenerated implicitly.
3. No network call without an Approved job (or an explicit user action such as "test connection").
4. Every artifact records provider, model + version, seed, inputs hash, and references used — enough to explain it later.
5. Schema versions are explicit; migrations are tested.

## Repo mechanics (non-obvious facts)

- **Workspace packages are consumed as TypeScript source** (`exports` points at `src/index.ts`; no per-package build).
  electron-vite bundles them into the app, so `externalizeDepsPlugin` must *exclude* `@tapestry/*` (see
  `packages/app/electron.vite.config.ts`; add new packages to that list). Vitest and `tsc --noEmit` read them directly.
- **TypeScript is pinned to 6.0.x** because TypeScript 7 (native compiler) has no stable programmatic API until 7.1, which
  typescript-eslint needs (its peer range is `<6.1.0`). TS 7 itself compiles every package: `pnpm typecheck:ts7` runs
  it, and an informational CI job tracks it. Migrate once typescript-eslint supports TS 7 (check `pnpm peers check`).
- **Repo rules are enforced by `pnpm check`:** `scripts/check-file-size.mjs` (400-line limit) and
  `scripts/check-deps.mjs` (dependency direction; `core` and `script` may not import `node:*` or `electron`). A new
  package must be added to `ALLOWED_INTERNAL` there, or the check fails on purpose.
- **Packaging tool:** electron-builder (chosen in plan 01, used from plan 19).
- **Renderer security:** `contextIsolation` and `sandbox` are on, `nodeIntegration` off, strict CSP in `index.html`.
  The renderer sees only `window.tapestry` from the preload script.
- **e2e:** Playwright launches the built app (`pnpm test:e2e` builds first); it passes `--no-sandbox` because Linux CI
  runners lack the setuid sandbox. CI uses `xvfb-run` on Linux.
- `pnpm verify` = everything CI runs except e2e. pnpm 12 blocks dependency install scripts by default; allowed ones are
  listed in `pnpm-workspace.yaml` (`electron`, `esbuild`).
