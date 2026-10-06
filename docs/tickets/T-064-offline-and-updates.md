---
id: T-064
title: Offline play, and a prompt to update when a newer version is out
status: open
size: M
area: ui
touches: [vite.config.ts, src/ui/main.tsx, src/ui/App.tsx, src/ui/version.ts, src/ui/Menu.tsx, package.json, .github/workflows/preview.yml]
blocked_by: [T-063]
notes: [N-0031]
created: 2026-10-06 02:02
---
## Problem
"Add an offline mode, and a way of updating the version of the game when a newer one is available."

## Context
This is the service worker T-063 left out on purpose ("not now; it adds update headaches", Oct 6); this note asks for it, along with the fix for those headaches, an update prompt. Build it after T-063's manifest and icons.

- Saves live in local storage, so caching the build doesn't touch them; an update only swaps the code. Old saves must still load in the new version (they already do across releases).
- The build version is injected as `__APP_VERSION__` (`src/ui/version.ts`, shown in the menu), handy for "v0.3.1 is ready".
- **Scope trap:** the main game's service worker at `/downtown-mars/` would also control the PR previews under `/downtown-mars/pr-preview/pr-N/` and serve them stale. Either previews register no service worker (and the main one skips `pr-preview/`), or each preview gets its own, scoped to its folder.
- Fonts come from Google Fonts; cache them too, or offline play falls back to a system font.
- The dev server shouldn't register one at all.

## Approach
`vite-plugin-pwa` (Workbox) in `prompt` mode: it precaches the built files and data, and fires an event when a new build has downloaded. The game shows a small banner, "A new version is ready (v…) · Update", that reloads into it; nothing changes mid-game without asking. It also checks for updates when the app comes back to the foreground and every so often. Answered (Bryon, Oct 6): updates come as a banner you tap, not silently; PR previews get no service worker (the main one skips `pr-preview/`). Done: an installed game (T-063) opens and plays in airplane mode; after a deploy, the next launch offers the update and taking it loads the new version with saves intact.

## Docs to update
GUIDE.md and README: offline play and updating. DECISIONS.md: previews and service workers.

## Open questions
- [x] Update style: a banner you tap (proposed), or apply silently on the next launch?
- [x] PR previews: no offline mode for them (proposed; they're short-lived), or the same as the main game?

## History
- 2026-10-06 02:02 opened from N-0031
- 2026-10-06 02:03 questions answered
