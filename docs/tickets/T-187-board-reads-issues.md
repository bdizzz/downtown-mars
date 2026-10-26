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

## Approach
One GraphQL query (paged) for issues with labels, parent, blocked-by, linked PRs and state. menu, show, graph and base from it; log becomes a comment plus label/state changes for `--status`, `--blocked-by`, `--feature`; agree creates sub-issues; feature-branch records the branch in the feature's body. Drop `publish` and `--here`. Done: menu and graph give the same board as today's files.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-26 19:05 building on t-186-migrate-tickets-to-issues
