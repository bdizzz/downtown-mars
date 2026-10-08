---
id: F-010
title: A comprehensive, interlinked playing guide (a wiki of the game)
status: agreed
plan:
notes: [N-0050]
created: 2026-10-08 02:06
---
## Goal
"A comprehensive playing guide, like a wiki of interlinked information about all the mechanics, resources, rooms, events, etc."

## Design
- **What exists:** `docs/GUIDE.md` (275 lines) is the player's guide, one long page by section (building, digging, homes, meals, water, materials, air, people, condition, events, more holes, views, controls, saving, settings). In the game, Help (? or F1) lists controls and build keys. The catalogs (`docs/ROOMS.md`, `EVENTS.md`, `PATHWAYS.md`) are design docs, not player-facing, and include unbuilt things.
- **Generated where it can be, written where it must be.** Pages for every room, resource, crop, event and material come from `data/*.json` (size, staff, inputs and outputs, effects, cost, unlocks, what uses it and what makes it), so they never drift from the game. Mechanics pages (air, water, condition, walking distance, neighbour effects…) are written by hand in markdown with front matter, and the generated pages link to them and back.
- **Interlinked:** every mention of a room, resource or mechanic is a link; each page lists "used by", "made by" and "see also"; a search box; back and forward.
- **Only what's built:** pages come from the game's data, so nothing describes a room that isn't in the game.
- **In the game:** a Guide panel (replacing or extending Help), opened from the menu and from "?" links in room panels, the build palette and the top bar; Godot shows the same pages through the bridge.

- **Answered (Bryon, Oct 8):** in the game first, the website later from the same pages; `GUIDE.md` is generated from the wiki's pages (one source); locked rooms and events are shown but marked locked, with how to unlock them.

## Breakdown
Agreed Oct 8. In build order after the first; 2 and 3 can go side by side.
- The page model and generator: pages from `data/*.json` (rooms, resources, crops, materials, events) plus hand-written mechanics pages, with links resolved and checked in a test. → T-092
- The reader in the web game: a Guide panel with links, search, back and forward. → T-093
- The mechanics pages: move `GUIDE.md`'s sections into linked pages (and generate `GUIDE.md` from them, or retire it). → T-094
- "?" links from the game's UI into the right page (room panel, palette, top bar, event cards). → T-095
- The guide as a website on GitHub Pages, from the same pages. → T-096
- The guide in Godot. → T-097

## Open questions
- [x] Where: in the game (proposed), on a website, or both (proposed: in the game first, the website from the same pages later)?
- [x] `GUIDE.md`: generate it from the wiki's pages so there's one source (proposed), or retire it?
- [x] Spoilers: should pages for rooms and events you haven't unlocked or seen yet be hidden or marked until you reach them? Proposed: shown, but marked as locked, with how to unlock.

## History
- 2026-10-08 02:06 opened from N-0050
- 2026-10-08 02:14 questions answered
- 2026-10-08 02:14 agreed
