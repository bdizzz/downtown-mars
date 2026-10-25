---
id: F-019
title: The room panel at a glance: a hierarchy of info, with icons, colors and sparklines instead of a wall of text
status: draft
plan: docs/PLAN-M18.md
notes: [N-0097]
created: 2026-10-25 10:43
---
## Goal
Bryon wants "a pass at the information architecture in the room detail panel" so it feels "less like a wall of text": a hierarchy where the most important things are visible at once and the rest sits behind a tooltip or accordion, with some of the information shown as icons, colors and the like rather than sentences.

## Design
**Where it is now.** The panel's content is built once in `src/view/roomPanel.ts` (`panelRows` → `{ before, after }` lists of `Row { k?, text, warn? }`) and drawn by the web's `src/ui/Inspector.tsx` (`Rows`) and by the Godot viewer through `src/bridge/inspect.ts`, so both say the same thing. Every row is a dimmed label plus a sentence; a busy room (a home, say: staff, flows, homes, walls, windows, crowding, within reach, felt, felt by) stacks ten or more of them with equal weight. Condition, construction, refit, stop-at and storage are their own blocks in `Inspector.tsx`.

**The plan: `docs/PLAN-M18.md`.** Four tiers in a fixed order (header with status pill and headline chips; alerts; an at-a-glance band of chips and meters; collapsible sections Work, Home, Serves, Surroundings, Building), built from one `panelModel()` both viewers draw. In short:
- Three tiers: a **header strip** (decided: name, a status color, staff and the room's main output; for a home, residents and happiness; status colors for working, short of staff, short of input, standing by, damaged), an **at a glance** band of icon + value chips and small meters (staff 3/4, condition, comfort/air, reach), and **details** in collapsible sections (Flows, People, Surroundings, Walls and windows, Felt by), closed by default except where something warns.
- A warning anywhere floats up into the header so it's never hidden in a closed section.
- Long explanations move into tooltips on the chip or row they explain.
- **No sparklines** (decided): icons, colors and meters only, so no per-room history in the sim.
- Give `Row` structure instead of only text: a tier or section, an icon id, a tone (good / neutral / warn / bad), an optional value and max for a meter, and keep `text` as the fallback and tooltip. The web and Godot both read the same structure.
- **Web and Godot together** (decided): each task changes both viewers in the same PR, so they never drift apart.
- Reuse what's there: `ui/Icon.tsx`, the Why? panel (T-171–T-175) for "why is this low", the cause bands.

**Related:** T-157 (upgrades listed in the room panel), T-147 (the happiness tooltip names what's raising and lowering it), F-003's refit block, F-017's upgrades. Whichever lands first, the other should slot into the new sections.

## Breakdown
Proposed; becomes tickets once this feature is agreed. Each step lands in web and Godot together (see `docs/PLAN-M18.md`, Steps).
- The panel model: `panelModel()` in `view/roomPanel.ts` (status, headline, alerts, glance, sections), `roomTone()`, new icons; the bridge sends it; both viewers draw today's rows from it, no visible change; tests (M)
- Header and alerts: status pill, headline chips, warnings raised to an alerts band with Connect in it (M)
- Collapsible sections with the controls moved into them, open state remembered (M)
- At a glance: glance chips, signed meters for felt effects and a home's factors, resource chips, long text into tooltips (M)
- Copy pass: shorter row text, every room family checked in both viewers, GUIDE.md screenshots (S)

## Open questions
- [x] What should be in the header at a glance for most rooms? My default: name, status color, staff, and the room's main output (or, for a home, residents and happiness).
- [x] Sparklines worth the per-room history (a little save size and snapshot traffic), or icons, colors and meters first and sparklines later?
- [x] Godot in the same feature, or web first with Godot as its own follow-up?
- [x] Remember the open sections across rooms, or reset to the defaults for each room? → Remembered. (Bryon, Oct 25)
- [x] Demolish at the bottom of Building, or behind a ⋯ menu in the header? → The bottom of Building. (Bryon, Oct 25)

## History
- 2026-10-25 10:43 opened from N-0097
- 2026-10-25 10:45 questions answered
- 2026-10-25 10:49 planning on f-019-room-panel-hierarchy
- 2026-10-25 10:56 questions answered
