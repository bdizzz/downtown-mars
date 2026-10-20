---
id: T-177
title: A one-time deputy card explains the fix when a cause first appears (bulkheads, restrooms, scrubbers…)
status: done
size: M
area: ui, data
feature: F-018
touches: [data/tutorial.json, src/ui/Tutorial.tsx, src/ui/tutorialGoals.ts, src/ui/settings.ts, docs/GUIDE.md]
blocked_by: [T-171]
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
"Extra tutorial steps like the purpose of building bulkheads" (Bryon): explain a mechanic when it starts to matter.

## Context
Read F-018. The deputy's card is `src/ui/Tutorial.tsx` with steps in `data/tutorial.json`; these are contextual, not part of the fixed sequence. F-007's guided tutorial may point at the same tips.

## Approach
Per cause, a one-time card when it first appears: smell or stale air reaching homes through corridors → bulkheads (with a highlight on the corridor); sanitation → restrooms; CO2 → scrubbers; clinic reach → clinics; crowding → more homes. Tips in data; seen ones remembered in the save; a Settings toggle turns them off. Also write GUIDE.md's Health and happiness section. Done: provoke each cause in a fresh game and see its card once.

## Docs to update
GUIDE.md: Health and happiness.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-20 12:39 building on ccr-ffc77851-fv2xl2 (with T-176, T-177, T-178)
- 2026-10-20 12:59 built
