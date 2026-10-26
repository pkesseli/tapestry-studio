# 18 — Sharing and publishing

## Needs human
Decide the sharing story for v1. Constraints: free tool, no hosting costs, and GitHub must not be used as a video host
(its terms discourage large binary media in repos). Recommendation below; amend this file if you choose differently.

## Goal
Make it easy to share finished work and to share *projects* (the script, entities and prompts) without us hosting media.

## Steps
1. **Project bundle**: export/import a project as a single `.filmloom` archive (zip) with options: with/without media,
   with/without rejected artifacts.
2. **Git-friendly sharing**: `filmloom init-repo` writes `.gitignore`/`.gitattributes` (media ignored or LFS note) so the
   script + assets metadata can live in a normal repo. Documentation says "share the recipe on GitHub; host the video
   elsewhere".
3. **Publishing helpers**: export presets and guided steps for YouTube/Vimeo (open the upload page with the file and
   metadata copied); optional direct upload via official APIs later.
4. Credits & provenance sheet: auto-generated list of models/providers and their terms, plus a "made with" line (opt-out).
5. Community gallery: out of scope here; record options (static site generated from bundle manifests, PeerTube,
   Internet Archive) in `90-backlog.md`.

## Acceptance
- Export -> import on another machine reproduces the project (metadata exact, media present when included).
- Provenance sheet lists every model used, from artifact records.

## On completion
Put the sharing principles (and the GitHub-as-video-host caveat) into `vision.md`. Remove this file.
