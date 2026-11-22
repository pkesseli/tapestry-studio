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
  should support both per shot (and per film), whichever engine is local or in the cloud. Slice 1 (the engine) is
  plan 09b; the rest waits for its review.
  - **Direct render:** one job per shot at the chosen quality, on this computer or a provider. The default and what
    plans 04 and 09 already describe.
  - **Draft, then guided HQ render:** make cheap local drafts of the whole film first and review and accept them like
    any clip. When the film basically exists, re-render the accepted drafts at high quality, locally or in the cloud, or
    simply upscale them (Real-ESRGAN-style, cheap, sharpens only). The re-render is guided by the accepted draft
    (its framing, motion and who is in it, plus reference images), so it keeps what was approved. Staged model to
    validate: stages with candidates, one accepted per stage, a final records its source draft, `n` finals can be made and
    one picked, a redone draft marks older finals "made from an older draft" (see plan 10b).
  - **Finishing scope (selective HQ render):** the expensive pass runs on a *selection*, not necessarily the whole
    film: any mix of shots, scenes or acts, picked from the scene list and shot panel (for example "all of Act Two",
    "just the shots with faces", "everything except the rejected ones"). The same selection drives what is rendered,
    what is estimated, and what the timeline uses (finished where present, draft elsewhere), so a film can be shown
    half-finished.
  - **Preview (the pilot; a distinct feature, not a mode of the scope picker):** one obvious button with its own place
    in the interface and its own wording, no selection needed. It lives on the film estimate: next to "finishing this
    film will cost about $X" sits "Try it first: make a preview of 3 shots for about $Y". One click picks the shots
    (default: one with people, one camera move, one static; adjustable but never required), renders only those, and
    shows each beside its draft. The creator then goes on, changes settings or stops after a small spend. It is also the
    natural thing to show backers before a campaign. Under the hood it is just a finishing scope with a preselected
    set of shots; the user never has to know that.
  - **Preview and estimate are linked both ways:** before a preview the whole-film estimate is shown as a range and
    labelled "not tested yet"; after it, the estimate narrows and says "based on your preview" (using the measured price
    and the share of previews that were acceptable). The estimate screen always offers the preview when none exists,
    and re-offers a new one when settings, provider or drafts have changed since. Naming to settle with the UX
    vocabulary (`ux.md`): "draft", "preview" and "pilot" must not collide with the existing job-state words.
  - **Estimate:** computed for any selection and always shown as three numbers: selected, remaining, whole film. The
    approved drafts fix the shot list and durations, so the cost is known: shot seconds times the provider's price per
    second times a retry factor (from how many finals are usually accepted, and from the pilot once it exists, which
    makes the estimate for the rest better). From an editable price table, flagged as an estimate, with the spend cap
    applying to the selection. Creators could use it to set a crowdfunding target ("if we reach $2000 we publish").
  - **Measured so far (M4 Pro 48 GB, LTX 2.3 distilled, one rater; details in `providers.md`):** direct render is the
    default. A draft previews framing and movement, not faces. Refining a draft with the same model changed faces and
    hands (6 of 10 shots kept); structure-conditioned re-renders lost identity; a 2x enlargement of the draft lost to a
    direct render (7 of 10 shots, 3 tied). So the draft is a preview, and the final is a fresh render at final quality
    with the same seed and references (plan 09b), not a refinement of the draft.
  - **Open questions (UNVERIFIED):** whether a cloud model can follow a local draft (some accept reference video; whether
    they preserve content is unknown), to be discussed when choosing a cloud service; how many previews are accepted in
    practice, which sets the retry factor of the estimate; crowdfunding platform rules on AI-made work and each
    provider's terms for commercial use of outputs (check before building anything for this).
- **Sound overlays and scene-spanning music (manual audio).** A creator can place their own sound: import a recorded line
  (their own voice), a music track or a sound effect, and put it on the timeline; and make one music track run under
  several scenes ("the same ominous score through Act Two"), looping or trimmed to fit, with fades and ducking under
  dialogue. Generated music (ACE-Step and others) is placed the same way. What exists: the timeline schema already has
  `dialogue`, `music` and `sfx` tracks and clips with volume and fades. What is missing:
  - **Imported artifacts:** an accepted, frozen artifact with no generating job (a source of `imported`, a content
    hash, a licence note field), because `Artifact.jobId` and the provenance provider are required today.
  - **Cues that follow the script:** a music or sound clip anchored to a range of scenes instead of absolute seconds,
    so it moves when scenes are reordered or a shot is replaced; plus loop, trim to the range, crossfade between cues.
  - **Mix:** per-track and per-clip volume and fades exist; add ducking under dialogue and loudness matching (the
    MiniMax and music tests showed very uneven loudness, and the clip audio from video models is not usable as dialogue).
  - **Interface:** a Sound section or lanes under the film, one-click "use this music across these scenes", with the
    waveform. Related: plan 13 (music), plan 15 (timeline and export, ffmpeg mixing).
