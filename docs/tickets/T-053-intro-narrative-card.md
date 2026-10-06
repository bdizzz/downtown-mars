---
id: T-053
title: An intro narrative card for new games
status: open
size: S
area: ui
touches: [src/ui/App.tsx, src/ui/Tutorial.tsx, data/tutorial.json, godot/]
blocked_by: []
notes: [N-0026]
created: 2026-10-06 01:26
---
## Problem
New games should open with a short narrative card: you're the administrator of a mission from Earth to build a lasting society on Mars; the surface is irradiated, so the colony goes underground, into the walls of the hole the drill is boring. Bryon wants it "exciting and easily readable by someone who really just wants to start playing".

## Context
Bryon approved this text (N-0026 follow-up):

> **Welcome to Mars, Administrator.**
>
> Earth sent you here to build something that lasts: a home where people can live for generations.
>
> There's a catch. Mars has almost no air and no magnetic field, so the Sun's radiation hits the surface unchecked. Stay up there too long, even in a suit or rover, and it catches up with you.
>
> So we go down.
>
> You have **20 colonists**, enough supplies to get started, and **one very large drill**. As it bores into the ground, you'll carve homes, farms and workshops into the walls of the hole.
>
> It's the only way to live here for good. Let's dig in.

The tutorial already opens with the deputy's line (`data/tutorial.json` `intro`, shown in `src/ui/Tutorial.tsx`). The text belongs in `data/` so Godot can show the same card; the colonist count should come from config (the landing kit's population), not be hard-coded.

## Approach
A modal card on a new game only (not on loading a save), one button ("Let's dig in" or "Start"), text from data. The game waits behind it (paused until dismissed). Same card in Godot via the bridge, in the same PR (Bryon, Oct 6), as long as the bridge can pass the text simply. Every new game, tutorial on or off.

## Docs to update
GUIDE.md: Starting out. README if it describes the opening.

## Open questions
- [x] Godot in the same PR, or a follow-up? Proposed: same PR if the bridge can pass the text simply.
- [x] Show it even when the tutorial is off? Proposed: yes, every new game; a "don't show again" setting isn't needed for one short card.

## History
- 2026-10-06 01:26 opened from N-0026
- 2026-10-06 01:29 questions answered
