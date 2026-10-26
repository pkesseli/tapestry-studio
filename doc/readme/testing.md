# Testing and running agent loops safely

## Layers

1. **Unit** (vitest): schemas, parsers, state machines, composer logic. Run on every change; must be fast.
2. **Contract** : every provider adapter passes the shared suite against recorded HTTP fixtures (no live calls in CI).
3. **Integration (headless)**: CLI runs a sample project end to end with the **mock provider**.
4. **UI** (Playwright against the web build of `app`): key flows — write script, create character inline, approve, review.
5. **Golden real generations**: tiny curated set, run manually or on a scheduled job with a spend cap. Output reviewed by
   a human. Never part of the default test run.

## Mock provider

Returns deterministic canned images/video/audio instantly, with configurable latency, failures, partial progress and
restart-resume behaviour. All queue/UI/timeline work is developed against it. It is the default provider in dev and CI.

## Spend and safety rules for loops

- Any code path that can spend money requires `FILMLOOM_BUDGET_CAP` (currency units) in the environment; if unset the
  provider layer refuses to submit to a paid provider. Caps are enforced in the queue, not in adapters.
- Loops run with the mock provider unless the plan file explicitly says "uses real provider X, budget Y".
- Live provider keys are never present in CI. Local keys live in the OS keychain or an untracked `.env`.
- Human checkpoints: after each milestone (see `doc/plan/` ordering), stop and ask the human to try the app; the
  target user's feedback outranks any plan.

## Hardware checks

Anything about the target MacBook (speed, memory, which models run) must be measured on it and recorded in
`providers.md` with date and machine. Agents cannot infer it.
