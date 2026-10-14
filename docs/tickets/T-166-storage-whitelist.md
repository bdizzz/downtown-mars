---
id: T-166
title: Storage rooms share their space first come, first served among the goods you allow
status: open
size: L
area: sim, ui
touches: [src/sim/storage.ts, src/sim/commands.ts, src/sim/economy.ts, src/sim/save.ts, src/view/roomPanel.ts, src/ui/Inspector.tsx, tests/]
blocked_by: []
notes: [N-0090]
created: 2026-10-13 20:43
---
## Problem
"Storage room[s] have so many slots of storage for their size, and then you whitelist which resources are allowed to be put into one of the slots. You don't reserve a certain number of slots for a bunch of resources anymore." A room of 200 that allows everything could fill all 200 with rock if rock comes first.

## Context
Today (M8, `src/sim/storage.ts`): each storage room (storeroom 90, warehouse 200, depot 440, the landing pod 600) has `storageUnits` shared out by `room.allocation` (units per good), none by default; a hole holds as much of a good as its rooms allot it, and the rest is lost or never unloaded. The panel's allocation control is in `src/view/roomPanel.ts` (shared with Godot).

## Approach
`room.allows` (a set of goods) replaces `allocation`; a hole's capacity for a good is the free space in the rooms that allow it, shared among goods as they arrive. New rooms allow everything. A good goes to the allowing room nearest to where it was made, then the next nearest. No caps or reserved space for now. Save version bump: old allocations become allows (any good with units). The panel: a checklist of goods with "all" and "none", and a bar of what's in the room now. Bots updated. Done: allow everything in a warehouse, dig, and watch rock fill it.

## Docs to update
DECISIONS.md: storage (M8) changes; GUIDE.md: Storage; PLAN-M8.md Notes as built (pointer).

## Open questions
- [x] What does a new storage room allow by default: everything, or nothing? (Claude's default: everything, so it just works.) → Everything. (Bryon, Oct 13)
- [x] With several rooms allowing the same good, which fills first? (Default: the nearest to where the good is made, else the emptiest.) → The nearest to where the good is made, then the next nearest. (Bryon, Oct 13)
- [x] Should there be a way to keep room for something, e.g. a priority per room or a "never more than N rock" cap, so rock can't crowd out food? (Default: not now; allows only.) → Not now; allowing goods is enough. (Bryon, Oct 13)

## History
- 2026-10-13 20:43 opened from N-0090
- 2026-10-13 20:47 questions answered
- 2026-10-13 21:50 building on t-166-storage-whitelist
