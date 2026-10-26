# 12 — Hosted API providers and key management

## Needs human
- Choose which providers to implement first (suggestion: fal.ai, Replicate, MiniMax API) and supply test keys.
- Set a real-money test budget (suggested: <= 10 currency units total for this plan).

## Goal
Remote generation through the same queue, safely.

## Steps
1. Key storage via Electron `safeStorage` (OS keychain); settings UI to add/test/remove keys; keys never in project folder or logs.
2. Adapter per provider implementing the contract; map each provider's models to capabilities and `limits`.
3. Model catalogue per provider with license/terms URLs, shown at first use with an "I understand" step.
4. Estimates from provider pricing (fetched or user-editable table), labelled as estimates; actual spend recorded.
5. Webhook-free design: polling with backoff; resumable after restart.
6. Fixture-based contract tests; one opt-in live smoke test per provider guarded by `TAPESTRY_BUDGET_CAP`.
7. Plug-in guide for third-party providers (short, in code docs next to the manifest schema).

## Acceptance
- Contract suite green for each adapter on fixtures.
- Live smoke test (human-triggered) generates one short clip per provider within the cap; spend recorded correctly.
- Without a cap set, submission to a paid provider is refused.

## On completion
Record per-provider gotchas (limits, quirks) in `providers.md`. Remove this file.
