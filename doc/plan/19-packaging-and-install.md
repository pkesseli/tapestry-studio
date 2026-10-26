# 19 — Packaging and install

## Needs human
Apple Developer account for macOS signing/notarisation (paid) — without it users get Gatekeeper warnings. Decide whether
to pay now or ship unsigned builds first with clear instructions.

## Goal
A non-technical person installs and opens the app in minutes.

## Steps
1. Tauri bundles for macOS (universal or arm64), Windows, Linux via GitHub Actions release workflow on tags.
2. Bundle ffmpeg (LGPL build, as external sidecar binary) with licence notices in an About screen.
3. First-run wizard: pick projects folder; choose "use a provider key" or "use local models" (explains what each means in
   plain words, with the measured expectations from plan 10); guided ComfyUI install help or detection.
4. Auto-update channel (Tauri updater) with signed updates; opt-in.
5. Crash/diagnostic export (local zip, no telemetry by default); issue template links to it.
6. Third-party licence report generated in CI and shown in the app.

## Acceptance
- Fresh macOS machine (human-run): download, open, create a project, run a mock-provider flow without terminal use.
- Release workflow produces artifacts and a checksum list.

## On completion
Release process into `README.md` (maintainers section). Remove this file.

## Milestone
**M3 reached after this file**: public pre-alpha release.
