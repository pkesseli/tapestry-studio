# 08 — Scene composer and the Shots section

## Goal
Turn a scene (or music section) plus its entities into concrete `GenerationRequest`s, with one click, within each
provider's reference limits. Includes the **Shots** section of the app (see `ux.md`): the scene's shot cards, what goes
into each, and "Queue this scene".

## Steps
1. Composer function (pure; `Beat`s from the script engine, plan 05, are its input; lives in `core` or `service`): inputs = unit, entities, provider
   limits, project style; output = list of requests (shots/segments) with chosen references and rationale.
2. Shot planning: split a scene into shots from action/dialogue beats with target durations <= provider max; allow manual
   edit of the shot list in the UI.
3. Prompt assembly from templates: scene context + per-shot action + entity descriptions; user can edit the final
   prompt (Advanced mode) and the edit is remembered.
4. Reference selection using the helper from plan 03: priority by role and recency; if entities exceed the limit, show
   which were dropped and why.
5. Dialogue handling: generate speech separately via voice entities, or request native audio if the provider supports it
   (user choice per project; default separate tracks).
6. "Queue this scene" button: creates Draft jobs with estimates; user approves all or individual shots.
7. Frame chaining (previous shot's last frame as next first frame) is out of scope here; see plan 16.

## Acceptance
- Snapshot tests: a sample scene with 3 characters and a limit of 4 references produces the expected selection and dropped list.
- Re-composing never touches Accepted shots.
- The Shots section shows planned shots with plain-language cost and time, and warns when someone in a shot has no look yet.

## Section review (blocks deletion of this file)
The human runs the section in the app and gives feedback; apply it here before removing this file (see `ux.md`).

## On completion
Document the selection algorithm in the module docs; remove this file.
