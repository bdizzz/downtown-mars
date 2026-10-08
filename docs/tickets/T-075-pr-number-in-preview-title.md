---
id: T-075
title: PR previews put the PR number in the page title
status: done
size: S
area: ui
touches: [.github/workflows/preview.yml, src/ui/main.tsx, src/ui/storageKey.ts]
blocked_by: []
notes: [N-0039]
created: 2026-10-06 19:31
---
## Problem
"In a PR build on github.io, we should prepend the PR id to the page title", so preview tabs can be told apart from the real game and from each other.

## Context
The preview workflow (`.github/workflows/preview.yml`) already builds each PR with `VITE_STORAGE_PREFIX: pr-N.` (read in `src/ui/storageKey.ts`). The title is `Downtown Mars` in `index.html`.

## Approach
Pass `VITE_PR_NUMBER` in the preview build and, when set, make the title `#N · Downtown Mars` at startup (and in the installed app's name if T-063's manifest is easy to stamp; optional). Done: a preview tab reads "#31 · Downtown Mars"; the main game and the dev server are unchanged.

## History
- 2026-10-06 19:31 opened from N-0039
- 2026-10-08 01:10 building on t-075-pr-number-in-preview-title
- 2026-10-08 01:11 built
