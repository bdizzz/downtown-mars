---
id: T-090
title: A snazzy title screen, shown while the game loads, with a loading bar
status: open
size: L
area: ui, render3d
touches: [index.html, src/ui/main.tsx, src/ui/App.tsx, src/ui/Menu.tsx, src/ui/styles.css, src/render3d/, src/view/font.ts, godot/src/]
blocked_by: []
notes: [N-0051]
created: 2026-10-08 02:06
---
## Problem
"A snazzy title screen to show when the game is first launched. This should fit with the overall aesthetic. We can also show this screen while loading all the assets as a real game loads (with a loading bar UI)."

## Context
The menu already has a `title` mode (`src/ui/Menu.tsx`, `mode: "title" | "pause"`), shown before a game starts. What loads at startup: the JS bundle, the Space Grotesk font (waited for before first drawing, `src/view/font.ts`), the Mars relief map (`data/mars-relief.jpg`), furniture models and textures for the 3D view, the sim worker. Art direction: cozy, warm 3D (`docs/ART.md`). T-053's welcome card follows on a new game; F-007 adds a tutorial choice there; T-064 will add an update prompt; T-088 reworks the menu's layout.

## Approach
- **A first screen in plain HTML/CSS** in `index.html` that shows instantly (before the bundle): the title, a Mars-dusk backdrop, and a loading bar.
- **Real progress:** list what startup loads (bundle, font, relief map, models and textures, worker ready) and advance the bar as each finishes; then hand over to the title menu with a soft fade.
- **The title itself:** a game logotype (the name, maybe a stylised borehole as the O), and behind the menu a slow, live 3D scene of a hole on Mars (a bundled showcase save, the camera drifting around it at dusk), falling back to a painted still on low graphics or phones.
- **Answered (Bryon, Oct 8):** a live 3D scene behind the title (a painted still on phones and low graphics); a simple SVG logotype; Godot is a follow-up.
- Done: opening the game shows the title and a moving bar immediately; the menu appears when everything's ready; it looks like the game.

## Docs to update
ART.md: the title screen. GUIDE.md: Getting started.

## Open questions
- [x] Behind the title: a live 3D scene of a hole (proposed), or a painted/illustrated still?
- [x] A proper logotype for "Downtown Mars" as part of this (proposed: a simple one, drawn as SVG), or keep the name in the UI font?
- [x] Godot in this ticket, or a follow-up (proposed: follow-up, as Godot loads differently)?

## History
- 2026-10-08 02:06 opened from N-0051
- 2026-10-08 02:14 questions answered
