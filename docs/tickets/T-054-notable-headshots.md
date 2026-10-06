---
id: T-054
title: Procedurally generated headshots for notables, with hints of their profession
status: open
size: M
area: ui, render2d
touches: [src/view/, src/ui/Office.tsx, src/ui/EventCards.tsx, src/ui/styles.css, src/sim/notables.ts, data/notables.json]
blocked_by: []
notes: [N-0027]
created: 2026-10-06 01:26
---
## Problem
"Create procedurally generated persona headshots for each of the notable people. For some of them, elements of their profession are incorporated into their profile picture."

## Context
Notables today show initials in a circle (`src/ui/Office.tsx`, `.face`). They have an id, name, role (`worker, organizer, scientist, doctor, merchant, administrator` in `data/notables.json`) and two traits (`src/sim/notables.ts`). Faces should be deterministic from the notable (hash of id and name), so the same person always looks the same, in saves and across web and Godot, and need nothing new in the sim state. Art direction: cozy, warm, readable (`docs/ART.md`).

## Approach
A pure SVG generator in `src/view/` (so the bridge can hand Godot the same SVG): head shape, skin tone, hair style and colour, eyes, brows, mouth, maybe glasses and freckles, a collar or suit, a background tint. Profession props on some (say half) of them, from data: worker a hard hat or ear defenders, doctor a stethoscope or head mirror, scientist goggles or a lab collar, merchant a scarf or a ledger pin, organizer a megaphone pin or armband, administrator a headset. Traits could nudge expression (Hothead frowns, Charismatic smiles). Use it wherever notables appear: the office, visits, event cards. Flat vector SVG (Bryon, Oct 6); Godot is a follow-up once the web look is agreed. Done: every notable has a distinct, stable face; a page of 20 looks varied and on-style.

## Docs to update
ART.md: notable portraits. GUIDE.md: The office, if it describes the faces.

## Open questions
- [x] Style: flat vector (cozy, matches the UI) or something else (pixel, painterly)? Proposed: flat vector SVG.
- [x] Godot in this ticket or a follow-up? Proposed: follow-up once the web look is agreed.

## History
- 2026-10-06 01:26 opened from N-0027
- 2026-10-06 01:29 questions answered
