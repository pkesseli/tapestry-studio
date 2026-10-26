# Vision

## Mission

Everyone with an idea should be able to make a film or a song. Filmloom removes the tooling barrier: no node graphs, no
terminals, no per-clip prompt engineering. The creator writes; the studio does the bookkeeping.

First user: a creative non-technical person on a MacBook Pro (Apple Silicon). If it is not intuitive for them, it is
wrong.

## Principles

1. **Script-first.** Characters, places, props, voices and instruments are created *while writing*, from the text.
2. **Queue, don't wait.** Generation is slow. Users approve work and come back later. The queue is a first-class,
   always-visible concept with plain-language states.
3. **Approved means frozen.** An accepted clip is the film. Later stages (enhance, upscale) never re-roll it.
   Re-generating on another model gives a *different* movie; the app must never do that implicitly.
4. **Local and remote are equals.** Same job, same review flow; only the provider differs. Cost and time are shown
   before approval.
5. **Plain files.** A project is a folder of text and media. Git-friendly, backup-friendly, no lock-in.
6. **Film and music share one toolbox.** Voices, instruments and arrangements are assets just like characters.
7. **Simple by default, deep on demand.** A "simple" surface for newcomers; advanced controls hidden, not removed.
8. **Honest about limits.** Say what current models cannot do (long-form coherence, hands, lip-sync drift) instead of
   promising Hollywood.

## Non-goals (for now)

- Hosting or streaming user media. Sharing = export + publish elsewhere (see plan 18).
- Cinematographer simulation (lens filters, false color, sensor profiles), 3D previs, multi-user collaboration.
- Training models. Using LoRAs/voices others trained is in scope; training pipelines are not.
- Competing with pro NLEs. We export to them (OTIO/FCPXML) instead.

## Licensing and clean-room policy

- This repo is **Apache-2.0**. Every dependency must be compatible (permissive or LGPL used as a separate process/dynamic
  link). No GPL/AGPL code in the shipped app. ffmpeg is invoked as an external binary, never linked.
- **AI Movie Studio 2** (AGPL-3.0) and similar tools are *feature references only*. Do not copy code, file layout,
  prompts, UI text or workflow JSON from them. Implement from the plan docs.
- Model weights have their own licenses, which are *not* ours to grant. The app must surface a model's license before
  first use and must not bundle weights. Example concern: MiniMax H3's community license reportedly excludes some
  jurisdictions (US, EU, UK, South Korea) — UNVERIFIED, read the actual text (as of 2026-10). Prefer permissively licensed
  models (e.g. Wan 2.x, reported Apache-2.0; UNVERIFIED) as local defaults.
- Generated media: copyright status and provider terms vary by country and provider. The app shows provider terms
  links; it gives no legal advice.

## Naming

"Filmloom" is a working name; trademark/availability is unchecked. See plan 01.
