---
id: T-187
title: board.mjs reads and writes the board through GitHub Issues
status: open
size: L
area: docs
feature: F-020
touches: [scripts/board.mjs]
blocked_by: [T-186]
notes: []
created: 2026-10-26 19:02
---
## Problem
`board.mjs` parses `docs/tickets/`; it should read the migrated issues instead and write through `gh`, with the same commands and the same output.

## Context
F-020's Design: live state stays derived (branch, PR, closed), open questions are body checkboxes, ids resolve from `#212`, `212`, `t80` (via `docs/ticket-ids.json`), and `t-0NN-…`/`f-0NN-…` branches still count.

As built: ids resolve from the titles themselves (`T-080 · …`), so `docs/ticket-ids.json` is a record, not something `board.mjs` reads. A bare number is the old ticket if there is one (`6` is T-006), else the issue; new issues start well past T-191, so they never clash. Issues, PRs and branches are fetched in parallel (about 3 s for the whole board). The header lines the migration writes (`opened …`, `notes …`, `**Touches:**`, `**Plan:**`, `**Branch:**`, `**Blocked by PR:**`) are how `board.mjs` reads those fields back. New commands for the skills (T-188, T-189): `new task|feature <title>` (sections on stdin, `--breakdown n` ticks a feature's line when agreeing it), `body <id>` and `set-body <id> [file]` for editing an item's sections. Gone: `publish`, `next-id` (an issue gets its number when made); `--here` is accepted and ignored. Done items the migration closed keep the date of their last history line, not the migration's.

## Approach
One GraphQL query (paged) for issues with labels, parent, blocked-by, linked PRs and state. menu, show, graph and base from it; log becomes a comment plus label/state changes for `--status`, `--blocked-by`, `--feature`; agree creates sub-issues; feature-branch records the branch in the feature's body. Drop `publish` and `--here`. Done: menu and graph give the same board as today's files.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-26 19:05 building on t-186-migrate-tickets-to-issues
