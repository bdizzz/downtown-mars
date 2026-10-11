---
id: F-017
title: Upgrades for each kind of room, with an up-front cost, a monthly upkeep and a new look
status: agreed
plan:
branch: feature/f-017-room-upgrades
notes: [N-0075]
created: 2026-10-11 15:52
---
## Goal
"Singular room-specific upgrades, tailored to each room type": performing one costs resources up front and/or a continuing monthly draw, and changes the room for the better and, in most cases, visibly.

## Design
Bryon's examples:
- **Clinic: upgraded medical diagnostic tools.** More effect on health; several electronics up front plus about 0.1–0.2 electronics a month.
- **Industrial or life-support room: fiber noise-damping panels.** Less noise for the neighbours; fiber up front plus a monthly "replace old fibers" budget.
- Most upgrades change the room's look: some furniture swapped for new pieces only upgraded rooms get, or other decoration.

Context: F-003 (agreed) is the general version: wall linings and floors, upgraded in place through the construction queue (T-033 is its Upgrade action, not built yet). This feature should reuse that action and its job, half output while refitting and the room panel's Upgrade control, rather than build a second path. Room effects and inputs are data in `data/rooms.json`; furniture and layouts in `data/furniture.json` and `data/layouts.json` (FURNITURE.md); windows (M13) are an in-place upgrade already built. A monthly draw is just another input per day (a game day is a month, T-021).

## Breakdown
Agreed; each line names its ticket.
- The upgrade model: `data/upgrades.json` (per room type: cost, upkeep per month, effect changes, furniture swaps, unlock), several per room type to pick from, some unlocked from the start (affordable or not: a path toward small, comfy holes or fast growth), `room.upgrades` in the sim and the save, applied through T-033's Upgrade action; what happens when the upkeep can't be paid (the upgrade idles). → T-156
- The room panel lists a room's upgrades with cost, upkeep and what they do; web and Godot through `roomPanel.ts`. → T-157
- Furniture swaps in the 3D view: upgrade-only pieces in layouts. → T-158
- The first upgrades: diagnostic tools (clinic) and noise-damping panels (heavy rooms), with their models. → T-159
- Several upgrades for every other kind of room, in batches by family, balanced in the playthroughs. → T-160

## Open questions
- [x] One upgrade per room type, or several to pick from (and can a room have more than one)? → Several to pick from. (Bryon, Oct 11)
- [x] Do upgrades go through the construction queue and take time, like F-003's refits? (Claude's default: yes, same job.) → Yes, the same construction job. (Bryon, Oct 11)
- [x] Unlocks: available from the start, or gated by population or a tech (research lab, later)? → Some are unlocked from the beginning, even if you can't afford them yet: a path toward building small, comfy holes or expanding quickly. (Bryon, Oct 11)
- [x] Should this wait until F-003's Upgrade action (T-033) is built? (Claude's default: yes.) → Yes, after T-033. (Bryon, Oct 11)

## History
- 2026-10-11 15:52 opened from N-0075
- 2026-10-11 16:08 questions answered
- 2026-10-11 16:10 agreed
- 2026-10-11 16:17 built on feature/f-017-room-upgrades
