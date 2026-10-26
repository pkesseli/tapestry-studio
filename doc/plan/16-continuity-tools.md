# 16 — Continuity tools

## Goal
Reduce character/location drift across a long film. This is the product's quality differentiator.

## Steps
1. **Drift scoring**: for each rendered shot, extract keyframes and score identity similarity against the entity's
   canonical sheet (face/body embeddings via a small local model or provider-agnostic hook); store scores on the artifact.
   If no embedding model is available, degrade gracefully (no score, UI says so).
2. Review UI: drift badge per shot; one-click "redo with stronger references".
3. **Chaining**: option to use the previous accepted shot's last frame as the next shot's first frame (needs provider
   support for first-frame or first/last-frame conditioning).
4. **Continuity board**: per scene, thumbnails of every accepted shot with entity-wise highlights; A/B wipe between
   adjacent shots (implemented independently from the idea of onion-skin comparison).
5. **Reference rotation**: composer can use shot-accepted frames as extra references for later shots (flagged, optional).
6. Wardrobe/time variants: entity variants selected per scene automatically from script cues.

## Acceptance
- On a fixture set with known drift, scores rank the bad shot lowest.
- Chaining works with the mock (verifies correct frames are passed) and with one real provider (human-run).

## On completion
Algorithm choices and thresholds go into module docs; summarise limits honestly in `vision.md` if relevant. Remove file.
