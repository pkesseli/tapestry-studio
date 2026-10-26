# Architecture

Status: **proposed**, not yet implemented. Confirm or amend in plan 01, then keep this file true.

## Shape

Desktop app: **Tauri 2** shell + **TypeScript/React** UI. Chosen for: small installers, good macOS support, easy
packaging for a non-technical user, and agent-friendly mainstream tooling. A pure local web server was rejected because
install friction is the main enemy. C++ was rejected: the work is UI, files, and network calls.

Monorepo (pnpm workspaces), packages with strict one-way dependencies:

```
core        pure TS: project format schemas, load/save, validation, migrations, ids. No I/O libs besides an fs port.
queue       job state machine, persistence, budgets, scheduling. Depends on core.
providers   Provider interface + built-in adapters (mock, comfyui, fal, replicate, ...). Depends on core.
media       ffmpeg wrapper (external binary), thumbnails, stitching, waveform. Depends on core.
script      screenplay/lyrics parsing, entity detection. Depends on core.
app         React UI + Tauri glue. Depends on all of the above.
```

Rule: `core` and `script` have no Node/Tauri imports so they can be tested instantly and reused (CLI, tests).
A headless **CLI** (`tapestry run <project>`) uses the same packages; it is how agent loops and CI exercise the system
without the UI.

Local model execution is **out of process**: Tapestry Studio talks to ComfyUI (HTTP/WebSocket) or other local servers.
If a bespoke local runner is needed for Apple Silicon, it is a separate sidecar process behind the same Provider
interface (see plan 10).

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
the OS keychain (via Tauri), never in the project folder.

## Invariants (do not break)

1. Project folder is the source of truth; app caches are disposable.
2. Accepted artifacts are never overwritten or regenerated implicitly.
3. No network call without an Approved job (or an explicit user action such as "test connection").
4. Every artifact records provider, model + version, seed, inputs hash, and references used — enough to explain it later.
5. Schema versions are explicit; migrations are tested.
