---
id: T-191
title: A GitHub Projects board kept in sync with the derived states
status: open
size: S
area: docs
touches: [scripts/board.mjs]
blocked_by: [T-187]
feature: F-020
notes: []
created: 2026-10-26 19:02
---
## Problem
A visual Kanban alongside `/board`. Optional.

## Context
F-020's Design, "Projects board". Needs `gh auth refresh -s project` first; the token doesn't have it yet.

## Approach
Create the Project and its Status field (Ready, Needs answers, Blocked, In flight, In review, Done); `board.mjs menu` writes each item's derived state to it.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
