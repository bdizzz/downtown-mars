---
id: T-189
title: The board, deps, build, try and land skills work from issues
status: done
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

As built: `land.mjs` closes the issues a PR settles when it merges into a feature branch (its `Closes #N` lines, else its `212-…` branch, else its `t-0NN-…` branch through `docs/ticket-ids.json` on the base). Once a PR's base has no `docs/tickets/`, it merges the base into the branch in a throwaway worktree, keeps the deletion (stopping if anything outside `docs/tickets/` conflicts), pushes, and leaves the merge for the next /land once CI passes; the git steps were checked in a scratch repo. `land.mjs` and `try.mjs` take `#212`, `212` and `212-…` branches. /build's PR body says `Closes #N`, and a feature's plan that fits in its issue needs no PR. Not done: `.claude/settings.json` (allowing `gh issue list` and `gh issue view`), which the session wasn't allowed to edit; the board commands are already covered by `node scripts/board.mjs *`.

## Approach
Update `/board`, `/deps`, `/build` (branch names, PR body, claim comment, no ticket commits), `/try` and `try.mjs` (new ids and branch names), and `land.mjs` (close a task's issue when it merges into a feature branch; when `docs/tickets/` conflicts, keep the deletion). Settings permissions for any new commands.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-26 20:05 building on t-188-notes-as-issues
- 2026-10-26 20:50 built
