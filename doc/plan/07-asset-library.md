# 07 — Asset library (characters, locations, props, voices, instruments)

## Goal
Create, view and refine entities, building each one's **canonical sheet** (the approved reference set reused everywhere).

## Steps
1. Library UI: grid by kind, search, entity detail page.
2. Entity detail: description, aliases, wardrobe/time variants, references with roles; drag-drop import of images/audio.
3. "Generate look" flow: from description produce N candidate images (image capability) through the queue; pick favourites
   -> they become the canonical sheet. Multiple angles prompt (front, profile, full body) generated as a batch.
4. Voice entities: import a speaker sample or choose a provider voice; preview line via speech capability; link to
   characters. Same entity type serves sung vocals later (plan 13).
5. Instrument entities: name, family, timbre description, optional sample; preview via music/sfx capability (stub until
   plan 14; works with mock).
6. Usage view: where an entity appears (scenes/sections).
7. Delete/merge entities with reference repair.

## Acceptance
- With the mock provider, create a character from a description, approve the batch, pick a canonical sheet, see it in the
  scene side panel.
- Merging two characters rewrites script references and unit refs without orphaning.

## On completion
Update `project-format.md` if the canonical-sheet rules changed. Remove this file.
