# 09 — Queue and review UI

## Goal
The signature experience: approve work, leave, come back, review, accept or redo. Must be understandable at a glance.

## Steps
1. Queue view with plain-language states and colours: *Needs your approval*, *Waiting*, *Making it*, *Ready to review*,
   *Accepted*, *Problem*. Hide internal state names.
2. Approval sheet: shows what will run, where (this computer / provider), estimated cost and time, remaining budget;
   "Approve all in this scene".
3. Review player: side-by-side compare of candidates for the same shot; keyboard shortcuts (A accept, R redo, N next);
   notes field; "redo with changes" opens the prompt/reference edit.
4. Accept = freeze (visible lock icon, tooltip explaining it); un-accepting requires an explicit confirm and keeps the file.
5. Notifications: OS notification when a batch finishes; badge on the app icon.
6. Failure UX: retry, change provider, or skip, with the provider's error translated into plain language.
7. Playwright tests with mock latency profiles (instant, slow, failing, restart mid-run).

## Acceptance
- Walk-through with the mock: approve 5 shots, quit the app, relaunch, review results, accept 3, redo 2.
- The target user can explain what each state means without help (human checkpoint).

## On completion
Add the user-facing state vocabulary to `vision.md` if it changed. Remove this file.

## Milestone
**M1 reached after this file**: script -> entities -> queued mock shots -> review. Stop and ask the human to try it.
