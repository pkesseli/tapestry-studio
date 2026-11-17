# 09b — Draft and final shots: stages, finishing scope, preview and estimate (engine first)

## Goal
Let a creator make a whole film cheaply as drafts, then spend on the final quality only where they choose, with a cost
they can see in advance. Slice 1 (this file's steps) is the engine: data model and pure logic, testable without a GPU.
UI slices follow, one section at a time, each reviewed by the human (see `ux.md`).

## Decisions from the measurements (`doc/readme/providers.md`, plan 10 and 10b, deleted)
- **Direct render is the default.** A draft previews framing and movement, not faces.
- **The final is a fresh render at final quality** with the draft's prompt, references and **seed**, not a refinement of
  the draft (refining changed faces and hands; enlarging the draft lost to a direct render). The same seed keeps the
  draft's framing and movement. Recurring characters need reference images.
- **Stages and takes.** A shot has two stages, draft and final. Each stage can have several takes (jobs); at most one is
  accepted per stage; accepted takes are frozen as today. A final records the draft it follows.
- **Several finals, pick one** is worth supporting: identity varied from 2 to 5 out of 5 across seeds.
- **Finishing scope**: the expensive pass runs on a selection of shots (any scenes or shots), not only the whole film.
- **Preview** (the pilot) is its own feature: one click, shots chosen for the user, shown beside their drafts, and linked
  to the whole-film estimate, which is a range "not tested yet" until a preview exists and then narrows.

## Slice 1: engine (no UI)
1. Schema, additive and optional so existing projects load unchanged (format stays at version 1, no migration):
   `GenerationRequest.quality` (`draft` | `final`; absent means `final`) and `Job.sourceJobId` (the accepted draft job a
   final follows). Providers interpret `quality` (a local model: fewer steps and lower resolution; a cloud provider that
   has no draft tier simply rejects `draft`).
2. `finalRequestFromDraft(draftJob)` in `core`: the request for the final (same prompt, references, audio inputs,
   duration and seed; quality `final`; no size, so the provider picks its own). Refuses a draft that is not accepted or
   has no seed.
3. `classifyShot` and `selectPreviewShots`: pick two or three representative shots (one with people, one with a camera
   move, one static by default), in script order.
4. `shotsInScope(scenes, scope)`: the shots in a selection (all, some scenes, some shots).
5. `estimateFinishing`: cost and time for the selected shots, the remaining ones and the whole film, from an editable
   price table, as a range until a preview exists and a narrower one after, from how many preview shots were accepted.
6. Document the fields and the rule in `doc/readme/project-format.md`.

Acceptance: unit tests for each function, including that a draft without a seed or not accepted is refused, that old
project files without the new fields still load and validate, and that the estimate range narrows after a preview.

## Next slices (each needs the one before; UI slices are built and reviewed one section at a time)
2. Service: "Make this shot" and "Make final" through the queue with the mock provider (small and fast for `draft`),
   after plan 08's composer.
3. Shot panel: draft and final strip, takes side by side, accept per stage.
4. Film estimate view with the finishing scope picker and the Preview button, linked both ways.
5. A local provider for LTX (plan 11) and a cloud provider (see Needs human).

## Needs human
- Choose the cloud service (done together later; the data so far says the cloud is the likely route for recurring
  characters, and it is UNVERIFIED whether a cloud model can follow a local draft).
- Wording: "draft", "preview" and "pilot" must not collide with the job-state words in `ux.md`.
- The assumptions of the estimate (acceptance-rate prior, price table defaults) are guesses until real previews exist.
