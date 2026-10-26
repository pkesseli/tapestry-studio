# 08 — Scene composer (units -> generation requests)

## Goal
Turn a scene (or music section) plus its entities into concrete `GenerationRequest`s, with one click, within each
provider's reference limits.

## Steps
1. Composer function (pure, in `core` or a new `compose` module under `queue`): inputs = unit, entities, provider
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
