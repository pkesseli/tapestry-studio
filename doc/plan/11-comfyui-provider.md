# 11 — ComfyUI provider (local or remote server)

## Goal
First real provider: drive any ComfyUI server (local, LAN or hosted) with workflow templates the app ships and users
can add — without the user ever seeing a node graph.

## Steps
1. Adapter in `packages/providers/comfyui` using ComfyUI's HTTP + WebSocket API (`/prompt`, `/history`, `/view`, `/ws`).
   Written from the public API docs, not from AGPL tools.
2. **Workflow templates**: JSON workflow files with declared parameter slots (prompt, seed, size, duration, reference
   images, audio) described by a small manifest. Ship templates for the models chosen in plan 10 (image look,
   image-to-video, first/last-frame video, reference-to-video where available).
3. Template import for advanced users: validate that required slots exist; detect missing models/custom nodes and tell
   the user in plain language what to install.
4. Upload references via ComfyUI's upload endpoint; fetch outputs; hash and store as artifacts.
5. Connectivity settings (URL, optional bearer token), "test connection" button (explicit user action).
6. Estimate: time from a rolling history of past runs on this machine; cost 0 for local.
7. Contract tests against recorded fixtures plus a fake ComfyUI server in tests.

## Acceptance
- Passes the provider contract suite.
- Manual: with a real ComfyUI (human-run), generate one image and one short video from the app via the queue.
- Missing-model case produces an actionable message.

## On completion
Template manifest format documented in code; add environment gotchas found to `providers.md`. Remove this file.
