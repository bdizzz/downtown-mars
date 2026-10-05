---
id: T-023
title: /try takes web, godot or both
status: open
size: S
area: docs
touches: [.claude/skills/try/SKILL.md, scripts/try.mjs, docs/PLAN-GODOT.md]
blocked_by: []
notes: [N-0019]
created: 2026-10-05 02:42
---
## Problem
"The 'try' skill should be able to take web/godot/both as input for what engine to start up."

## Context
- `/try` (`.claude/skills/try/SKILL.md`, `scripts/try.mjs`) picks a checkout and a port from 5174 and starts the web dev server in the Terminal panel. Web only today.
- Running Godot from a checkout: `cd godot && dotnet build`, then `godot-mono --path godot -- --port=<n>`; the viewer starts its own bridge on that port. **Never touch Bryon's own game**: his bridge is on 17878 and saves in `~/.downtown-mars/saves`; test runs use another port and `DM_SAVES=<scratch folder>` (PLAN-GODOT.md, "Testing the viewer"). After a run the bridge needs stopping (`pkill -f "bridge.mjs --port=<n>"`).

## Approach
`try.mjs <target> [web|godot|both]` (default web): for Godot, build in that checkout, pick a free bridge port (e.g. from 7980, one per checkout), a scratch saves folder per checkout, and print the command; the skill runs it in its own terminal tab and says how to stop it (and its bridge). `both` runs the two tabs. Done: `/try t21 godot` opens the ticket's Godot viewer without touching Bryon's saves or bridge.

## Docs to update
- CLAUDE.md (the /try row), PLAN-GODOT.md (Testing the viewer).

## History
- 2026-10-05 02:42 opened from N-0019
