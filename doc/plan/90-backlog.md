# 90 — Backlog (deliberately NOT actionable)

Promote an item into a numbered plan file (with goal, steps, acceptance) before working on it. Order is rough priority.
Items marked (parity) exist in AI Movie Studio 2 — implement from the idea only, never from its code.

- Long-take mode: chained first/last-frame segments stitched into one continuous shot (parity). Builds on plans 15/16.
- Final Draft `.fdx` import polish and screenplay export (PDF) .
- Lip-sync / audio-driven facial animation pipeline (parity).
- Take slating, circle-take ratings and shot metadata (parity).
- Retake canvas: mask a region of a frame and re-roll it (parity).
- LoRA management for local models; voice/character LoRAs shared by community.
- 3D previs stage and camera trajectory conditioning (parity) — only if a simple, non-cinematographer version is possible.
- Optical/film-look post passes (grain, halation, diffusion) as optional enhance steps (parity).
- Optional LLM assistant: script doctoring, beat sheets, auto shot lists, entity description writing (provider plug-in,
  never required).
- Storyboard-first mode (images before video) with approval gates.
- Community gallery options: static site from bundles, PeerTube, Internet Archive.
- Collaboration: shared projects via git workflows, comment threads.
- Localisation of the UI.
- Accessibility audit (keyboard, screen reader, colour contrast).
- Plug-in marketplace/registry (only after the plug-in API stabilises).
- Remote-control API (authenticated HTTP/WebSocket from the desktop app) and a bespoke mobile companion client for
  writing, reviewing and approving from the queue. Not a wrapped desktop UI; the client/logic boundary is documented in
  `doc/readme/architecture.md`. Open questions: secure remote access (LAN vs tunnel), file sync for scripts/metadata,
  App Store / Play Store policies for AI-generation apps (unchecked).
- **Guided in-app tutorial** on the Demo Film project (install creates it, see plan 19): walks a new user through writing
  scenes and acts, adding characters, places and props from the text, how shots are planned, approving work, reviewing
  in context, and accepting. Interactive steps with highlights, skippable, restartable from a Help menu. Wait until the
  interface has settled; the Write section and its acts, search and position memory are the first lessons.
- **Two ways to make a shot: direct render, or draft then guided high-quality render.** The project format and queue
  should support both per shot (and per film), whichever engine is local or in the cloud. Promote together once plan 10b
  has a verdict (`spikes/draft-final/results/summary.md`), and after plans 09 and 17.
  - **Direct render:** one job per shot at the chosen quality, on this computer or a provider. The default and what
    plans 04 and 09 already describe.
  - **Draft, then guided HQ render:** make cheap local drafts of the whole film first and review and accept them like
    any clip. When the film basically exists, re-render the accepted drafts at high quality, locally or in the cloud, or
    simply upscale them (Real-ESRGAN-style, cheap, sharpens only). The re-render is guided by the accepted draft
    (its framing, motion and who is in it, plus reference images), so it keeps what was approved. Staged model to
    validate: stages with candidates, one accepted per stage, a final records its source draft, `n` finals can be made and
    one picked, a redone draft marks older finals "made from an older draft" (see plan 10b).
  - **Confidence gate:** before committing a whole film to the expensive pass, finish two or three shots first and
    compare them with their drafts. The app offers this as a "pilot" step with an estimate for the rest.
  - **Whole film estimate:** the approved drafts fix the shot list and durations, so the cost of the HQ pass is known:
    shot seconds times the provider's price per second times a retry factor (from how many finals are usually accepted).
    Show "what finishing this film will cost" from an editable price table, flagged as an estimate. Creators could
    use it to set a crowdfunding target ("if we reach $2000 we publish"). Also a way to estimate per scene or shot.
  - **Open questions (UNVERIFIED):** whether a cloud model can follow a local draft faithfully (some providers accept
    reference videos; whether they preserve content is unknown); whether finals are indistinguishable from a direct
    render at the same quality (plan 10b measures similarity to the draft, not quality against a direct render); the
    time saving depends on how many drafts are rejected, and cheaper drafts gave finals that follow the draft less
    closely (measured on LTX 2.3 distilled, M4 Pro 48 GB); what "high quality" means for local use (about 832x448 at
    24 fps from LTX distilled; 2x upscale to about 1664x896); crowdfunding platform rules on AI-made work and each
    provider's terms for commercial use of outputs (check before building anything for this).
