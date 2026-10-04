---
id: T-006
title: Restrooms become a walking-distance amenity (a comfort lever)
status: open
size: M
area: sim, data
touches: [src/sim/amenities.ts, src/sim/economy.ts, data/rooms.json, data/furniture.json, src/view/roomPanel.ts]
blocked_by: [T-005]
notes: [N-0005]
created: 2026-10-04 18:03
---
## Problem
Once people's water turns gray directly (T-005), restrooms no longer handle water. Bryon wants them to matter another way, and more comfort levers in general "so you have enough tools to keep people happy."

## Context
- Agreed (N-0005): restrooms are an **amenity by walking distance**, like parks and clinics (`src/sim/amenities.ts`, M11). Homes with bathroom furniture (the suite, for example) count as covered. Being far from a restroom costs comfort; a nearby one is a small plus.
- Today restrooms give **sanitation** for 25 seats, and missing sanitation costs health (`noSanitationHealthLossPerDay` in `src/sim/economy.ts`).
- Bathroom furniture: look for toilet/shower pieces in `data/furniture.json` and `data/layouts.json` to decide which homes count.

## Approach
Add restrooms to the amenity table with a walking radius and capacity; a home counts as covered if it's in range or has its own bathroom. Comfort: minus when not covered, small plus when close. Show it in the room panel and the comfort overlay. Done: a home far from restrooms shows the comfort cost and why.

## Docs to update
- DECISIONS.md: restrooms are an amenity by walking distance.
- GUIDE.md: Restrooms / comfort.
- ROOMS.md: restroom row.

## Open questions
- [x] Comfort only, with a health cost kept for very poor coverage (under half covered). (Bryon, Oct 4)
- [x] Walking distance: 6 steps (60 m). (Bryon, Oct 4)

## History
- 2026-10-04 18:03 opened from N-0005
- 2026-10-04 19:05 questions answered
