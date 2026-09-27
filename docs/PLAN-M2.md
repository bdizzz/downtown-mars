# Milestone 2 plan: polish and persistence

Goal: make the milestone 1 hole shareable for playtests (itch.io). Nothing new in the simulation's scope; everything around it gets good enough that a stranger can pick it up, understand it, keep their progress and come back.

Decided Sep 27, 2026 (Bryon): milestone 2 is polish and persistence. The network layer comes later and will use real Mars terrain for its map.

## Defaults (chosen, not yet confirmed)

- **Saves:** the whole sim state as versioned JSON. Derived data (the effect field) is rebuilt on load. Stored in the browser's localStorage: one autosave written every game day, plus 3 manual slots. Export and import as `.json` files, as DESIGN.md's tech plan says. A save from an incompatible version is refused with a clear message, not half-loaded.
- **Menus:** a title screen (Continue, New game, Load) and an in-game menu (Esc when nothing is selected, or the Menu button) that pauses the game.
- **Build mode:** keep the side palette, but make it a proper catalog: rooms grouped by category, cards with cost, staff, inputs, outputs and neighbor effects, number-key hotkeys, a rotate button, a live halo preview of the room's neighbor effects while placing, drag to paint corridors, and undo for the last placement.
- **Art:** still drawn in code, no image assets. Auto-tiled frontage (shaft windows, doors on corridors, plain walls between rooms) and a simple glyph per room type. Direction written up in `docs/ART.md` for a future artist.
- **Flow diagram:** a river-style (Sankey) panel per resource, showing sources on the left and uses on the right, averaged per day. The water view links clean, gray and black water so the recycling loop shows.
- **Tutorial:** a deputy notable walks through the first 30 minutes as a short checklist of goals. It can be dismissed, and it remembers it was dismissed.
- **Audio:** synthesized with Web Audio, no files: UI clicks, build, demolish, drop landing, visitor chime, alert. Volume and mute persisted in settings.
- **Packaging:** relative asset paths, Pixi split into its own chunk, and `npm run package` producing a zip ready for itch.io. Nothing is uploaded automatically.

## Steps

1. **Save and load.** Versioned save format, worker save/load messages, autosave, slots, export/import, title screen and in-game menu. *See:* quit, reload, continue where you were.
2. **Build-mode UI.** Categorized catalog with room cards, hotkeys, rotate button, effect halo preview, corridor painting, undo. *See:* placing rooms feels deliberate and informed.
3. **Frontage and room art.** Auto-tiled walls, windows and doors; per-room glyphs; nicer surface; `docs/ART.md`. *See:* the hole reads at a glance.
4. **Flow diagram.** Per-resource ledger in the sim; Sankey panel; linked water view. *See:* where every drop of water goes.
5. **Tutorial.** Deputy notable, goal checklist, highlights, dismiss and remember. *See:* a new player gets through the first 30 minutes unaided.
6. **Audio.** Synthesized SFX and ambient hum; volume settings. *See (hear):* builds, drops, visitors.
7. **Settings and help.** Settings panel (volume, UI scale, colour-blind-safe overlay palette, autosave on/off), keyboard shortcuts overlay. *See:* the game adapts to the player.
8. **Playtest packaging.** Relative base, chunking, version stamp, `npm run package` zip, README with controls. *See:* a zip that runs from a static host.

## Notes as built

**Step 1, saves:** `src/sim/save.ts` writes `{ game, version, state }` without the effect field; loading rebuilds it and refuses other games, other versions and unknown room types. A loaded game continues tick-for-tick like the original (tested). The worker bumps a `gameId` on new game and load so the view drops its caches. Browser storage keys are `downtown-mars.save.<slot>`; autosave happens when the game day changes. Esc closes whatever is open, and opens the menu when nothing is. Menus pause the sim.

**Step 2, build mode:** the palette groups rooms by category with letter hotkeys (C corridor, D dorm, G galley, F farm, T tank, Y recycler, W restroom, L life support, K clinic, A admin, B battery, S solar, P pad, X demolish). Hovering or selecting a room shows its card: cost (short items in red), staff, flows, storage, and neighbor effects in words. While placing, the room's strongest effect is previewed as a halo, spread exactly as the sim spreads it, and the status bar says what the spot already feels like. Dragging with the corridor tool paints corridors (sent straight to the sim, which validates them in order). ⌘/Ctrl+Z undoes this session's placements for a full refund within 6 game hours (`economy.undoWindowTicks`).

**Step 3, art:** `src/render2d/art.ts` holds code-drawn glyphs for every room type and surface props (pod, pad, solar panels), plus hills and stars. The stage auto-tiles frontage from each face's neighbor: shaft windows with a gallery door on ring 1, doors wherever a face meets a corridor, plain walls otherwise; corridors show floor markings in the direction they run. Direction for real art is in `docs/ART.md`.

**Step 4, flows:** `src/sim/ledger.ts` records every movement of every resource under a label: the room type's name, Colonists, Restrooms, Digging, Earth drops, Construction, or Overflow (made or delivered with nowhere to store it). Days are closed at midnight and the diagram averages the last 4 complete days (`economy.ledgerDays`); a test checks that in − out equals the change in stock for every resource. The Flows panel (HUD button) draws each resource as a river: sources left, uses right. The water tab stacks clean, gray and black water and states the recycling share. The scripted player now lives in `tests/bot.ts`.

**Step 5, tutorial:** the first notable is your deputy. `data/tutorial.json` holds their lines: an intro, 13 goals following DESIGN.md's first 30 minutes (galley, restroom, corridor, life support away from homes, tank, dorm, noise overlay, first drop, two farms with different crops, answer a visitor, open Flows, recycler, clinic) and an outro. Checks live in `src/ui/tutorialGoals.ts`; goals complete in any order and the matching button pulses. The card can be minimized or hidden (remembered in browser storage) and brought back from the menu. A test confirms the scripted player meets every goal by day 15. Two optional counters were added to the sim (`earth.landed`, `office.answered`); old saves load without them.

**Step 6, audio:** `src/audio/sound.ts` synthesizes everything with Web Audio: build, demolish, refusal buzz, drop landing, visitor chime, alert, and a thud when a floor is dug; a low brown-noise bed plus a hum that grows with the number of life support machines. Audio starts on the first click or key press (browser rule). `useSounds` turns sim events (new messages, new floors) into sounds and doesn't replay old events after a load. Clicking where a room can't go now says why and buzzes. Volume, effects and ambient come from the settings store (`src/ui/settings.ts`), which step 7 exposes.
