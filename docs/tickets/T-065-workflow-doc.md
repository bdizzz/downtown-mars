---
id: T-065
title: A doc describing the dev workflow: skills, stages and why
status: done
size: S
area: docs
touches: [docs/WORKFLOW.md, CLAUDE.md, README.md, docs/tickets/README.md]
blocked_by: []
notes: [N-0033]
created: 2026-10-06 02:12
---
## Problem
Bryon wants a doc describing the dev workflow: when to use which skill, the general flow of stages, and, succinctly, why it's done this way.

## Context
The pieces are spread around: CLAUDE.md ("Playtest notes and the board", "Commit messages"), `docs/tickets/README.md` (tickets, features, feature branches, derived status), the skills themselves (`.claude/skills/{note,ingest,board,deps,build,try,land}/SKILL.md`), `scripts/board.mjs`, `scripts/try.mjs`, `scripts/land.mjs`, the SessionStart hook (`.claude/hooks/fresh-main.sh`), CI and PR previews (`.github/workflows/`), and the memory notes about parallel sessions and publishing tickets straight to main.

## Approach
A new `docs/WORKFLOW.md`:
- **The flow:** play → `/note` → `/ingest` (tickets and features, questions) → answer → `/board` and `/deps` to pick → `/build` (worktree, branch, PR with a preview link) → `/try` (web, Godot or both; feedback goes back on the PR) → `/land`. Features: draft → `/build F-0NN` for a plan → agree → tasks, optionally on a feature branch merged last.
- **When to use which skill:** a short table, one line each, with an example.
- **Why:** succinct reasons, e.g. notes kept word for word so nothing's lost in translation; tickets checked in so any machine can build them; status worked out from GitHub so it never needs syncing or collides; one ticket per branch and worktree so several sessions can run at once; previews so a change can be played without checking it out; Conventional Commits for a readable history.
A diagram of the stages would help (Mermaid renders on GitHub). Link it from CLAUDE.md's design-docs table and the README's Developing section; trim duplication where CLAUDE.md can just point at it. Done: someone new could follow a note from inbox to merged PR from this doc alone.

## Docs to update
CLAUDE.md: the docs table, and point "Playtest notes and the board" at the new doc. README: Developing.

## History
- 2026-10-06 02:12 opened from N-0033
- 2026-10-07 19:05 building on t-065-workflow-doc
- 2026-10-07 19:06 built
