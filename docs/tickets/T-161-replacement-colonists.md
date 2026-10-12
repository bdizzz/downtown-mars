---
id: T-161
title: Below 20 colonists, supply drops sometimes bring replacements, to pull a hole out of a tailspin
status: open
size: S
area: sim, balance
touches: [src/sim/earth.ts, data/config.json, tests/]
blocked_by: []
notes: [N-0085]
created: 2026-10-12 19:55
---
## Problem
"When under 20 colonists, supply drops should sometimes carry a handful of replacement colonists. This can help get you out of a tailspin."

## Context
Drops already bring up to `colonistsPerDrop` (6) colonists, but only when average health is at least `colonistsNeedHealth` (50) and there are free beds (`src/sim/earth.ts` around line 128, `earth` in `data/config.json`). A hole in a tailspin usually fails the health check, so it gets nobody. Related: T-162 (what happens at zero).

## Approach
A rescue rule in `config.json` (`earth.rescue`: below 20 people, a chance per drop, 2–4 colonists), skipping the health check (and maybe the beds check). A news line saying Earth sent replacements. A test: a hole at 10 people with poor health gets some over a few drops. Done: a dying hole can recover.

## Docs to update
GUIDE.md: Earth and supply drops; DECISIONS.md: the rescue rule.

## Open questions
- [ ] Do replacements need free beds, or can they arrive homeless? (Claude's default: they need beds; a hole with none gets none.)
- [ ] How often and how many? (Default: half of drops, 3 people.)
- [ ] Should difficulty (F-014) change this, say none on hard?

## History
- 2026-10-12 19:55 opened from N-0085
