---
id: F-001
title: Water as a closed loop
status: draft
plan:
notes: [N-0005]
created: 2026-10-04 19:12
---
## Goal
Water is largely a closed loop from the start, given power and upkeep. A colony stops leaning on supply drops full of water; the player's job becomes balancing clean against gray water, and not losing too much to tailings. Restrooms find a new role as a comfort lever.

## Design
Agreed with Bryon on Oct 4 (N-0005, Claude's proposal plus his answers on T-005, T-006 and T-007):
- **Clean water is one shared pool**, like power. Anything that uses clean water (people, farms, galleys and kitchens, clinics, gyms, parks, industry; not life support) turns the same amount into **gray** right away, 1:1. Only clean water can be used.
- **Treatment** (the water recycler) turns gray back into clean, costing power, with noise. It returns about **97%**; the rest is **sludge that becomes soil**, slowly.
- **Tailings** (not "black water", which means toilet waste in real life): the silicon refinery and concrete plant send half their water to tailings, the brickworks a quarter, and the electronics fab (given 2 water a day) half. Everything else returns all of it as gray. Early on, tailings can only be stored; if storage is full, the overflow just disappears for now. The **tailings reclaimer** (300 colonists) turns them back into gray.
- **Life support is a true sink**: water split into oxygen is gone for good. It's the one deliberate leak besides tailings, and shrinks a lot once the air mix exists (F-002).
- **Wells bring in gray** (salty brine in the story). Supply drops and trade still top up what leaks away.
- **Water tanks choose what they hold** (clean, gray or tailings), the way a farm picks its crop. When the gray tanks are full, rooms using water stall.
- **Restrooms become an amenity by walking distance** (6 steps), like parks and clinics. Homes with their own bathroom count as covered. Comfort only, with a health cost kept for very poor coverage (under half covered).
- **The composter stops taking water** (scraps → soil).
- **The water charts show exactly what converts water**, by source and by user, replacing today's single "colonists" consumer and the restroom return.

## Breakdown
- The loop itself: clean and gray pools, per-room gray and tailings returns in the data, the recycler at 97% plus soil, gray wells, the tank's "holds" choice, charts by source and user, save migration (blackWater → tailings), the opening rebalanced so bots don't need water drops → T-005
- Restrooms as a walking-distance comfort amenity → T-006
- The tailings reclaimer room → T-007

## History
- 2026-10-04 19:12 made from T-005 (T-012 moved the water loop into a feature); tasks T-005, T-006, T-007
