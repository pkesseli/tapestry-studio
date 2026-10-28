# 06 — App shell and the Write section (first reviewable prototype)

## Status
Built and tested (unit, service and Playwright tests). **Waiting for the section review below.** Run it with `pnpm dev`
(set `TAPESTRY_PROJECT` to use another folder).

## Goal
A real, runnable first slice: open a project, write a screenplay, see scenes and names recognised, and add characters,
places and props inline. Nothing else is built yet; the other tabs exist but say what is coming.

## Steps
1. **`packages/service`** (UI-free; depends on core and script): use cases over an `FsPort` — open or create a project,
   read state, save a script (re-analyse, re-derive scenes, persist), create an entity. Entity factory in `core`.
2. **IPC**: typed, versioned API in `packages/app/src/shared/api.ts`; main process stays thin (calls the service through
   `NodeFs`); preload exposes it as `window.tapestry`. Environment variable `TAPESTRY_PROJECT` selects the folder (used
   by tests); otherwise the app opens `Documents/Tapestry Studio/My First Film`, created from a short example screenplay.
3. **Shell**: top bar with the tabs from `ux.md` (only Write is active), the project name, and a **practice-mode
   indicator that is visibly separate** from normal chrome (see `ux.md`, principle 4). Design tokens in `styles.css`;
   Figtree and Courier Prime bundled locally (CSP allows only `self`).
4. **Write section**: CodeMirror 6 editor with screenplay styling by element type, marks for known/unknown names from
   `@tapestry/script`, autosave (debounced) and undo history; scene list on the left (filmstrip frames are dashed empty
   placeholders until shots exist); "In this scene" panel on the right (cast, places and things, unresolved names).
5. **Inline creation**: a small card at an unknown name (name, one-line description, Add / Not now, Enter to add);
   the same from the right panel. Adding re-analyses at once so the mark turns teal.
6. Playwright test of the flow: type a new character cue, add her from the card, see the mark and the panel update.

## Acceptance
- `pnpm dev` opens the example project; typing in the editor never lags and survives a restart.
- A non-technical tester can write three lines of dialogue and have both characters created without leaving the editor.
- No operation in this plan makes a network call.

## Section review (blocks deletion of this file)
The human runs the app and gives feedback; apply it here. Then the user's wife tries it. Only then continue.

## On completion
Update `ux.md` with anything the review changed. Remove this file.
