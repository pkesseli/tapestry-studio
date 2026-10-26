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
