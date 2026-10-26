# 03 — Provider interface, contract tests, mock provider

## Goal
The single plugin boundary for every generator (video, image, speech, music, sfx, upscale), plus a mock that makes the
rest of the system developable without GPUs or money.

## Steps
1. Define in `packages/providers`: `ProviderLimits`, `Estimate`, `Provider` interface. (`Capability` and the
   provider-neutral `GenerationRequest` already exist as schemas in `core`, plan 02; see
   `doc/readme/providers.md`.) The interface has `estimate/submit/poll/cancel`.
2. Provider manifest schema (id, name, capabilities, config schema, terms URL, pricing hints) and a registry that loads
   built-ins and a user plugin folder (manifest + JS entry; no remote code execution, no auto-update).
3. Shared **contract test suite** that any adapter must pass (retry-safe submit, resumable poll, cancel, limits honoured,
   error mapping to `retryable | permanent`).
4. **Mock provider**: deterministic placeholder media per capability (generated test-pattern video, tone/noise audio,
   gradient images carrying the prompt text), configurable latency/failure/progress, state that survives restart.
5. Reference-budget helper: given a candidate reference list and `ProviderLimits`, choose references by role priority.

## Acceptance
- Mock passes the contract suite; a deliberately broken adapter in tests fails it.
- Requests that exceed limits are rejected by `estimate` with a clear reason, not by the network.

## On completion
Interface docs live in the code. Keep only the "rules for adding a provider" in `providers.md`; remove this file.
