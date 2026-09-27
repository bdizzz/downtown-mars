# Decision log

A condensed record of the design conversation (Sep 26–27, 2026) between Bryon and Claude: what was decided, what changed along the way, and what is still open. Use this to avoid reviving ideas that were already rejected.

## Source of truth

When documents disagree, trust them in this order:

1. **This log** (most recent decisions and reversals)
2. **ROOMS.md**, **EVENTS.md**, **PATHWAYS.md** (detailed catalogs)
3. **DESIGN.md** (main design doc; some early sections are stale, listed below)

## Key decisions

**Identity**
- Name: **Downtown Mars**. Tagline: **"Hole sweet hole."** A quick web search found no game with that name; a proper trademark check is still needed before launch. "Hole Sweet Hole" was rejected as the title because a 2005 adult film uses it.
- Vibe: SimCity, SimTower, Terraforming Mars; Frostpunk-style social tension but chill. Sandbox; high score is total supported population.

**Player and time**
- The player is an overseer who can drop into any hole's administration office. All holes simulate at once; local administrators run the others.
- Real time with pause and speed controls.
- Story: Earth-sponsored start, then independence (with player choices) or Earth collapse, then self-reliance.

**Simulation scale**
- Colonists run as **pools** (cohorts) plus up to ~20 named **notables** per hole. Holes range from a few dozen to 10,000+ people.

**Views and tech**
- 2D unrolled view and 3D cylinder, switchable, drawing the same data. Build 2D first.
- Web first (TypeScript, PixiJS, React, Vite), sim in a Web Worker, data in JSON. Godot possibly later.

**Space**
- Rooms sit at (floor, ring, slot). Up to 6 rings: 1–3 at start, 4–5 with reinforcement frames, 6 via an excavation milestone.
- Outer rings have more slots; narrow holes grow outward, wide holes grow down.
- **Corridors take slots** (spokes and ring segments); no dedicated corridor rings. A walkway gallery rings the shaft, so ring 1 needs no corridors. A full loop of ring segments is a faster "ring road."
- Rooms come in S/M/L/H (1/2/4/8 slots). Most L/H rooms choose wide, deep or tall; grand plaza, stadium and reactor are at least 2×2×2; arena, theater, farm atrium and commons are at least 2 floors tall.
- Public rooms (plazas, markets, food courts, stadiums) are walk-through; private and industrial rooms block movement.
- Frontage is automatic: shaft-facing windows (+1 comfort), doors and storefronts on corridors and plazas, no wall where a corridor meets a plaza.

**Economy**
- Natural resources: regolith (rock, silica), water ice, ores, CO2 atmosphere; energy from sun, geothermal, reactors. Everything else is made.
- Silica → silicon refinery → wafers → electronics fab.
- Glass is optional on every room; substitutes cost more and lower comfort. Marscrete can replace brick at 1.5× with a comfort penalty but better cave-in resistance.
- Money has three eras: Earth credits, barter after the break, then a player-founded Mars currency.
- Rooms need staff; output scales with staffing; rooms have priority tiers for shortages.

**Starting game**
- 20 colonists, a landing pod (temporary housing for 20 plus an admin desk), landing pad, one solar array, one battery.
- Critical set: bunk dorm, life support, water tank, restroom, galley.
- Then **two farms with different crops** (e.g. potatoes 12 + soybeans 8 = 20 food), water recycler, second solar array, clinic, excavator bay, admin office.
- Earth covers rations, water, spare oxygen and metal, machinery, electronics early on. One hole can survive alone but can't grow alone (no ore or no silica), which pushes the network.

**Network**
- New holes are seeded from a parent's staging bay; volunteers set the child's starting culture.
- Rovers and pipelines move goods; routes can be disrupted and defended.
- Culture: four sliders (Work–Leisure, Order–Freedom, Earth–Mars, Open–Insular); opinions −100 to +100 with five tiers; blocs; cohesion within holes; abandonment of unviable holes.
- An independent asteroid belt society is a third trading partner; holes can trade with it as a bloc.

**Systems defined in full elsewhere**
- 32 ordinances with slot limits by admin office size (DESIGN.md, Ordinances).
- Event catalog with strike chain, hazards, discoveries and story beats (EVENTS.md).
- Crops, size ladders, security, plazas, vertical transport, tourism rooms (ROOMS.md).

## Reversals (don't revive these)

- **Farm scaling:** farm yields were briefly raised ~1.7× so one farm fed the starting crew. Reverted: yields are back to original values, and the start uses **two farms** so players learn diet variety.
- **Kitchen and canteen at start:** replaced by a single small **galley** for the opening; kitchen and canteen are later upgrades.
- **Bar name:** briefly renamed to "Bar." Reverted to **"Bar and lounge."**
- **Gym and park:** originally one combined room; now separate rooms (gym for health, park for comfort and air).
- **Mushrooms:** a crop choice for a regular farm, not a separate room (a diagram labeled it "Mushroom farm" for clarity).
- **Electronics input:** "rare minerals" was replaced by silicon wafers.
- **Restrooms:** no longer consume their own water; they provide sanitation for 25 and return users' water as gray and black water.
- **Life support:** raised from 10 to 30 oxygen so the starting crew has margin.

## Cleanup before handoff

These sections were brought in line with the catalogs, both in this kit and in the live design doc.

- DESIGN.md "Rooms and adjacency" table updated to match ROOMS.md.
- DESIGN.md's early room list relabeled "Early room brainstorm." Library, restaurant and drill production facility are unadded ideas, not decided rooms.
- Room sizes corrected everywhere to L = 4 slots, H = 8 slots.
- First playable version now lists the full starter set, including two farms, battery bank, landing pad and oxygen.
- PATHWAYS.md no longer lists restrooms as water consumers.

## Standing rules easy to miss

- Each water tank holds only one type of water: clean, gray or black (from Bryon's early room list).

## Still open

Deliberately not decided yet:

- **Simulation model:** how several holes run efficiently. (Milestone 1 defaults for tick rate, flows, effects and the 2D view were settled Sep 27; see PLAN.md.)
- **Build mode and UI flow:** digging, placing rooms, choosing size, shape and materials, reading overlays.
- **Art and audio direction.**
- **Full balancing pass:** only the starter rooms are balanced; mid- and late-game numbers are rough placeholders.
- **Build roadmap:** milestones beyond the first playable version.
- **Smaller items:** difficulty settings, tutorial flow, save format, accessibility, mod support.
- **Trademark check** for "Downtown Mars."
