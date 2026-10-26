---
id: T-189
title: The board, deps, build, try and land skills work from issues
status: open
size: M
area: docs
touches: [.claude/skills/, scripts/land.mjs, scripts/try.mjs, .claude/settings.json]
blocked_by: [T-187]
feature: F-020
notes: []
created: 2026-10-26 19:02
---
## Problem
The other skills still talk about files, `publish` and `--here`.

## Context
F-020's Design: new branches are `212-<slug>`, PRs say `Closes #N`, a claim is a pushed branch plus a comment. `Closes` only fires on merges into main.

## Approach
Update `/board`, `/deps`, `/build` (branch names, PR body, claim comment, no ticket commits), `/try` and `try.mjs` (new ids and branch names), and `land.mjs` (close a task's issue when it merges into a feature branch; when `docs/tickets/` conflicts, keep the deletion). Settings permissions for any new commands.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
