---
id: T-190
title: Cut over to issues: rewrite the workflow docs and remove docs/tickets
status: open
size: S
area: docs
touches: [docs/WORKFLOW.md, CLAUDE.md, docs/tickets/, docs/notes-archive.md]
blocked_by: [T-188, T-189]
feature: F-020
notes: []
created: 2026-10-26 19:02
---
## Problem
The last step before F-020's branch merges into main.

## Context
F-020's Design, "Cutover".

## Approach
Rewrite `docs/WORKFLOW.md` and the board sections of `CLAUDE.md`, move `notes-archive.md` to `docs/`, delete `docs/tickets/`. Then freeze ticket edits, rerun the migration, add `Closes #N` to open PRs, and merge the feature branch.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
