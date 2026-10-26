# 17 — Enhancement stage (upscale / refine accepted clips)

## Goal
Raise the quality of accepted clips without changing their content — the "draft once, enhance later" path.

## Steps
1. Add capability `upscale` (and `refine`) to the provider contract; `Enhance` job type that takes an Accepted artifact and
   produces a new linked artifact (original untouched).
2. Providers: at least one local upscaler (via ComfyUI workflow template) and one hosted option. Verify whether
   MiniMax H3's "Regenerate-2K" conditions on the existing clip or re-generates from prompts (read its docs/model card);
   only expose it as "enhance" if it preserves content, otherwise label it "re-render".
3. UI: "Enhance all accepted" with estimate; side-by-side before/after; per-clip accept of the enhanced version.
4. Timeline can use Enhanced where present (user-selectable per clip).
5. Audio enhancement (denoise/loudness) via ffmpeg as a cheap first step.

## Acceptance
- A clip upscaled via mock and via one real provider (human-run) produces a linked artifact; timeline swaps cleanly.
- Test proves no enhance path can regenerate from prompts and call it "enhance".

## On completion
Record measured fidelity findings in `providers.md`. Remove this file.
