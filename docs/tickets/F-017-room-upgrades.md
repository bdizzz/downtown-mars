---
id: F-017
title: Upgrades for each kind of room, with an up-front cost, a monthly upkeep and a new look
status: draft
plan:
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
Proposed; becomes tickets once this feature is agreed.
- The upgrade model: `data/upgrades.json` (per room type: cost, upkeep per month, effect changes, furniture swaps, unlock), `room.upgrades` in the sim and the save, applied through T-033's Upgrade action; what happens when the upkeep can't be paid (the upgrade idles).
- The room panel lists a room's upgrades with cost, upkeep and what they do; web and Godot through `roomPanel.ts`.
- Furniture swaps in the 3D view: upgrade-only pieces in layouts.
- The first upgrades: diagnostic tools (clinic) and noise-damping panels (heavy rooms), with their models.
- An upgrade (or two) for every other kind of room, in batches by family, balanced in the playthroughs.

## Open questions
- [ ] One upgrade per room type, or several to pick from (and can a room have more than one)?
- [ ] Do upgrades go through the construction queue and take time, like F-003's refits? (Claude's default: yes, same job.)
- [ ] Unlocks: available from the start, or gated by population or a tech (research lab, later)?
- [ ] Should this wait until F-003's Upgrade action (T-033) is built? (Claude's default: yes.)

## History
- 2026-10-11 15:52 opened from N-0075
