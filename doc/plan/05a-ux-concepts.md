# 05a — UX concepts (design review before building screens)

## Needs human
This is a joint review. The human (and ideally the target user) reacts to the mockups; the agent revises them. Do not
start plan 06 until the human has signed off the flows below.

## Goal
Agree on the look, the vocabulary and the key flows *before* any real UI exists, while changes are still cheap.

## Steps
1. Build clickable HTML mockups (no app code, throwaway) of the key screens, light and dark:
   - Writing: script editor, a new name appearing, inline "create character" card, side panel with the scene's entities.
   - Library: entity grid, a character detail page with its canonical sheet, a voice, an instrument.
   - Scene composer: a scene's shot list, per-shot references, "queue this scene" with cost/time estimate.
   - Queue: plain-language states, approval sheet, notification of a finished batch.
   - Review: candidate comparison, accept (freeze) / redo, a failure message in plain language.
   - Music: a song with sections, the arrangement grid (sections x instruments), audio review.
   - First run: choosing between provider keys and local models.
2. Write down the UX principles that fall out (tone of words, density, what is hidden in Simple mode, keyboard
   shortcuts, accessibility baseline: keyboard-only use, screen-reader labels, contrast, text scaling).
3. Agree on a small design system: colour tokens (light/dark), type scale, spacing, component list (button, card, sheet,
   toast, tag, player). Implemented later in plan 06 as tokens + Radix-based components.
4. Review rounds with the human until the flows feel right; record decisions and rejected ideas.

## Acceptance
- The human has approved each flow listed in step 1 (or explicitly cut it).
- Principles and tokens are written to `doc/readme/ux.md` (the one readme created by this plan).

## On completion
Keep the mockups out of the repo unless they are small and useful as a reference (`doc/ux/`); remove this file.
