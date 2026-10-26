# 06 — UI shell and script editor

## Goal
The first thing a user sees: open/create a project, write a script, and create entities inline.

## Steps
1. App shell: project picker/creator, left nav (Script, Library, Scenes, Queue, Timeline, Music), global queue badge.
2. Simple/Advanced mode switch stored per project; Simple hides provider details, seeds, raw prompts.
3. Script editor (CodeMirror 6 or similar): Fountain mode and song mode, live parse from plan 05.
4. Inline entity creation: unresolved mention shows a subtle underline; click or `Ctrl/Cmd+.` opens a quick-create card
   (name, one-line description, optional "generate a first look" button that creates a Draft job). Resolved mentions
   link to the entity.
5. Side panel: entities in the current scene/section with thumbnails.
6. Autosave to the project folder; undo history survives reload.
7. Playwright test for the flow: type a new character name -> create inline -> appears in Library.

## Acceptance
- A non-technical tester can write three lines of dialogue and have both characters created without leaving the editor.
- No operation in this plan makes a network call.

## On completion
Keep UX principles (if any new) in `vision.md`; the rest is code. Remove this file.
