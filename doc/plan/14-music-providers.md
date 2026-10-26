# 14 — Music, speech and SFX providers

## Needs human
- Decide which services are acceptable (hosted music services often restrict API use and add commercial terms; read them).
- Real-money budget for smoke tests.

## Goal
Real audio generation behind the provider interface: music, speech/voice cloning, sound effects.

## Steps
1. Using plan 10 results, pick the local-first candidates (e.g. ACE-Step, MusicGen/AudioCraft — verify weights licenses
   before shipping defaults; speech: open TTS/voice-clone models) and run them through ComfyUI workflow templates
   (plan 11) or a small sidecar if ComfyUI is unsuitable.
2. Hosted: adapters for at least one speech provider and one music provider that publish an API and clear terms
   (selected under *Needs human*).
3. Capability mapping: `music` (full mix / stems / vocals), `speech` (voice sample -> line), `sfx`.
4. Voice-consistency: always pass the entity's voice reference; record which sample/version was used in the artifact.
5. Licence surfacing: show each model's terms (commercial use? attribution?) in the review/export dialog.
6. Contract + fixture tests; opt-in live smoke tests under budget cap.

## Acceptance
- One local and one hosted route produce an accepted song section and a spoken line using the same voice entity.
- Export dialog lists the terms of every model that contributed to a project.

## On completion
Record verified model facts and licence cautions in `providers.md`. Remove this file.
