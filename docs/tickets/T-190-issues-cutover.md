---
id: T-190
title: Cut over to issues: rewrite the workflow docs and remove docs/tickets
status: done
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

As built: the docs (`docs/WORKFLOW.md`, the board section of `CLAUDE.md`, links from `DECISIONS.md` and the plans) are rewritten for issues in the PR. Deleting `docs/tickets/` and moving the archive aren't: the cutover's migration rerun has to read the ticket files after main's newest edits are merged in, so those steps live in `scripts/cutover.mjs` and run at the very end. It merges main into the feature branch, reruns the migration, moves `notes-archive.md` to `docs/`, deletes `docs/tickets/`, commits and pushes that, and adds `Closes #N` to open PRs from ticket and feature branches. A dry run on the feature branch (Oct 27) wanted 13 issue writes (the F-020 tasks' bodies and histories, closing T-186–T-189) and `Closes` lines on PRs #319, #95 and #74. To cut over: stop editing tickets on main, run `node scripts/cutover.mjs --apply` from a checkout of `feature/f-020-github-issues`, then `/land feature/f-020-github-issues`.

## Approach
Rewrite `docs/WORKFLOW.md` and the board sections of `CLAUDE.md`, move `notes-archive.md` to `docs/`, delete `docs/tickets/`. Then freeze ticket edits, rerun the migration, add `Closes #N` to open PRs, and merge the feature branch.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-27 02:35 building on t-190-issues-cutover
- 2026-10-27 03:00 built; the cutover itself is `scripts/cutover.mjs --apply`
