---
id: T-161
title: Below 20 colonists, supply drops sometimes bring replacements, to pull a hole out of a tailspin
status: done
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
A rescue rule in `config.json` (`earth.rescue`: below 20 people, half of drops bring 3 colonists), skipping the health check but still needing free beds; none on hard once F-014 lands (a difficulty multiplier). A news line saying Earth sent replacements. A test: a hole at 10 people with poor health gets some over a few drops. Done: a dying hole can recover.

## Docs to update
GUIDE.md: Earth and supply drops; DECISIONS.md: the rescue rule.

## Open questions
- [x] Do replacements need free beds, or can they arrive homeless? (Claude's default: they need beds; a hole with none gets none.) → They need beds. (Bryon, Oct 12)
- [x] How often and how many? (Default: half of drops, 3 people.) → Half of drops, 3 people. (Bryon, Oct 12)
- [x] Should difficulty (F-014) change this, say none on hard? → Yes: none on hard, via F-014's multipliers. (Bryon, Oct 12)

## History
- 2026-10-12 19:55 opened from N-0085
- 2026-10-12 19:59 questions answered
- 2026-10-12 20:07 building on t-162-game-over
- 2026-10-12 20:17 built
