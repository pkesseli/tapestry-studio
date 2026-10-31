# 19 — Packaging and install

## Needs human
Apple Developer account for macOS signing/notarisation (paid) — without it users get Gatekeeper warnings. Decide whether
to pay now or ship unsigned builds first with clear instructions.

## Goal
A non-technical person installs and opens the app in minutes.

## Steps
1. Electron installers via GitHub Actions on tags: macOS dmg (arm64 + x64), Windows NSIS/MSI, Linux AppImage, deb, rpm. Then package-manager channels: Homebrew cask, winget, Scoop, Chocolatey, Flathub, Snap.
2. Bundle ffmpeg (LGPL build, as external sidecar binary) with licence notices in an About screen.
3. **Folders and demo project (TODO, design after the UX settles):** the installer (or first launch) creates the
   user's `Tapestry Studio` folder in their documents folder (`Documents` on Windows, redirected folders such as OneDrive
   included, `~/Documents` on macOS, the XDG documents folder on Linux; the app already resolves it with Electron
   `getPath('documents')`) and a `Demo Film` project in it with sample footage. Ship only footage whose license allows it
   (Sintel is CC BY 3.0, with attribution shown in the app) and keep the installer small. Then offer the guided tutorial
   (backlog).
4. First-run wizard: pick projects folder; choose "use a provider key" or "use local models" (explains what each means in
   plain words, with the measured expectations from plan 10); guided ComfyUI install help or detection.
5. Auto-update channel (electron-updater) with signed updates; opt-in.
6. Crash/diagnostic export (local zip, no telemetry by default); issue template links to it.
7. Third-party licence report generated in CI and shown in the app.

## Acceptance
- Fresh macOS machine (human-run): download, open, create a project, run a mock-provider flow without terminal use.
- Release workflow produces artifacts and a checksum list.

## On completion
Release process into `README.md` (maintainers section). Remove this file.

## Milestone
**M3 reached after this file**: public pre-alpha release.
