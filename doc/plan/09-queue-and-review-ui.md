# 09 — Queue and review sections

## Goal
The signature experience: approve work, leave, come back, review, accept or redo. Must be understandable at a glance.

## Steps
1. Queue view with plain-language states and colours: *Needs your approval*, *Waiting*, *Making it*, *Ready to review*,
   *Accepted*, *Problem*. Hide internal state names.
2. Approval sheet: shows what will run, where (this computer / provider), estimated cost and time, remaining budget;
   "Approve all in this scene".
3. Review player: side-by-side compare of candidates for the same shot; keyboard shortcuts (A accept, R redo, N next);
   notes field; "redo with changes" opens the prompt/reference edit. **Always in context:** the player can step to the
   previous and next shot of the scene (accepted ones included) and play a clip right after its predecessor, so a take
   is judged against what surrounds it.
4. Accept = freeze (visible lock icon, tooltip explaining it); un-accepting requires an explicit confirm and keeps the file.
5. **Practice-mode clips carry a visible "Sample" tag** in lists and in the player (provider manifest flag `sample`),
   and the queue offers "replace samples with real shots" once a real engine exists (see `ux.md`, principle 4).
6. Notifications: OS notification when a batch finishes; badge on the app icon.
7. Failure UX: retry, change provider, or skip, with the provider's error translated into plain language.
8. Playwright tests with mock latency profiles (instant, slow, failing, restart mid-run).

## Acceptance
- Walk-through with the mock: approve 5 shots, quit the app, relaunch, review results, accept 3, redo 2.
- The target user can explain what each state means without help (human checkpoint).

## Section review (blocks deletion of this file)
The human runs the section in the app and gives feedback; apply it here before removing this file (see `ux.md`).

## On completion
Add the user-facing state vocabulary to `vision.md` if it changed. Remove this file.

## Milestone
**M1 reached after this file**: script -> entities -> queued mock shots -> review. Stop and ask the human to try it.

Before the checkpoint, make CI publish **unsigned installer artifacts** (electron-builder: macOS dmg, Windows installer,
Linux AppImage) so the target user can run M1 on her own Mac without a dev setup. Signing, package managers and
auto-update stay in plan 19.
