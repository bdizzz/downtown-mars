---
id: T-186
title: Migration script copies every ticket and feature to GitHub Issues
status: open
size: M
area: docs
feature: F-020
touches: [scripts/migrate-issues.mjs, docs/ticket-ids.json]
blocked_by: []
notes: []
created: 2026-10-26 19:02
---
## Problem
Every T and F item in `docs/tickets/` needs to exist as an issue, with its state, parent, blockers and history, before the board can read from GitHub.

## Context
F-020's Design has the mapping table and the migration section; follow it. Sub-issues (`/issues/{n}/sub_issues`) and blocked-by (`/issues/{n}/dependencies/blocked_by`) APIs answer on this repo (checked Oct 26). Parse tickets with the same rules as `board.mjs` (`parseTicket`).

## Approach
`scripts/migrate-issues.mjs`: dry run by default, `--apply` to write; idempotent by the id at the front of each title. Labels, features, tickets in id order, sub-issue and blocked-by links, close done/dropped with the right reason, "Shipped in #N" from the merged `t-0NN-…` PR, History as the first comment, then write `docs/ticket-ids.json`. Pace writes about a second apart. Done: one real run, and 10 sampled items (open, done, dropped, hibernating, a feature, a blocked task) match their files.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-26 19:05 building on t-186-migrate-tickets-to-issues
