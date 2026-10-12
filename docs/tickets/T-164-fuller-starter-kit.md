---
id: T-164
title: A new game's first hole starts with air, water tanks and power built; later holes with a battery only
status: open
size: M
area: sim, data
touches: [data/config.json, src/sim/state.ts, src/sim/founding.ts, data/tutorial.json, src/ui/Welcome.tsx, tests/]
blocked_by: [T-028]
notes: [N-0088]
created: 2026-10-12 19:55
---
## Problem
"When starting a new game, the first hole should have a few things beyond the battery already added since a player is brand new to the experience": battery, electrolyzer, CO2 scrubber, clean and gray water tanks, but not dorms or galleys, "so that players figuring out how the game works won't lose their first hole immediately." Maybe a choice, or on hard just a battery (not on normal or easy). "Subsequent holes in a game should start with just a battery (and surface stuff)." "We'll have to adapt the tutorials etc depending on which version the player starts with."

## Context
The kit is `landingKit` in `data/config.json`: on the surface a landing pod, landing pad and solar array; in floor 1's rings the entrance and a battery bank. Placed in `createInitialState` (`src/sim/state.ts`); later holes are founded in `src/sim/founding.ts` (check what they get now). The electrolyzer and CO2 scrubber don't exist yet: T-028 (F-002) builds them to replace life support. Difficulty is F-014 (T-122 in the sim, T-123 the picker, not built). Tutorials: `data/tutorial.json`, `src/ui/Tutorial.tsx`, and F-007's guided tutorial.

## Approach
Built after T-028. Two kits in data: `full` (battery, electrolyzer, CO2 scrubber, a clean water tank and a gray water tank) for a new game's first hole, and `bare` (battery and the surface) for later holes and hard. For now every new game gets `full`; F-014's picker later gives hard the bare start and offers it on normal as a "veteran" option (add that to T-123). The current tutorial goals skip steps whose rooms are already built. Done: a new game starts with those rooms working; a second hole with just a battery; tests and bots pass from both starts.

## Docs to update
GUIDE.md: starting out; DECISIONS.md: the starter kits; tutorial text.

## Open questions
- [x] The electrolyzer and scrubber don't exist yet (T-028). Ship this now with life support and swap it when T-028 lands, or wait for T-028? (Claude's default: now, with life support.) → Wait for T-028. (Bryon, Oct 12)
- [x] A choice for the player on the new-game screen, or set by difficulty only (full on easy and normal, bare on hard)? Difficulty isn't built yet (F-014). (Default: full for now; F-014's picker sets bare on hard.) → The full kit for now; F-014's picker gives hard the bare start. (Bryon, Oct 12)
- [x] Should the bare start be offered on normal too, as a "veteran" option? → Yes: a "veteran" bare start offered on normal too. (Bryon, Oct 12)

## History
- 2026-10-12 19:55 opened from N-0088
- 2026-10-12 19:59 questions answered
