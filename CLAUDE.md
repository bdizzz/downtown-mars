# Downtown Mars — project guide

*Hole sweet hole.*

A real-time city builder on Mars. Each city is a **borehole**: you dig a shaft down, carve rooms into its walls in rings and floors, and grow a network of holes across the planet whose cultures drift apart. Two layers, one idea: proximity creates effects. Rooms affect neighboring rooms inside a hole; holes affect each other across the map.

Vibe: SimCity, SimTower and Terraforming Mars, with some of Frostpunk's social tension but chill rather than crushing. Sandbox mode; total supported population is the high score.

## Design documents (in `docs/`)

| File | What it holds |
| --- | --- |
| `DECISIONS.md` | Condensed decision log: key decisions, what was decided while building, reversals not to revive, open questions. Read this first. |
| `DESIGN.md` | Main design doc (the target): borehole, rings, corridors, shapes, frontage, economy, culture, network, ordinances, story, tech plan. Opens with where the build stands; stale sections carry **As built** notes. |
| `ROOMS.md` | Room catalog: every room's size, staff, inputs, outputs, effects, cost and unlock; size ladders; crops; material substitution. |
| `ROOM-STATUS.md` | Which catalog rooms are built and which are only described, graded by what each needs first. Generated: `node scripts/room-status.mjs` (rerun after adding rooms). |
| `PATHWAYS.md` | Each resource family traced from source to users, with what's built. |
| `EVENTS.md` | Event catalog: citizen visits, strike chain, hazards, discoveries, network, Earth and belt, story and notable events, with what's built. |
| `PLAN.md`, `PLAN-M2.md` … `PLAN-M15.md` | Milestone plans, each with "Notes as built". M1 first playable, M2 polish and saves, M3 3D, M4 two holes, M5 people, M6 corridors on edges, M7 construction time, M8 storage, M9 excavation and the entrance, M10 furnishing (and later work: condition, new rooms, afterglow, charts, air quality), M11 the sealed network: gallery tubes, air and smell through corridors, amenities and services by walking distance; M12 bulkheads, airlock dust, crowding, window walls, glass and the shaft dome; M13 doors on any wall and windows as an upgrade; M14 events with choices: drill discoveries, a belt ship in distress, celebrations; M15 (planned, F-003) room materials, finishes and floors, upgraded in place. |
| `PLAN-GODOT.md` | The Godot + C# desktop viewer (`godot/`): how the live viewer works, its "Status and next" list, and notes as built. |
| `WORKFLOW.md` | The dev workflow: from playtest note to merged PR, which skill runs each stage, and why it's done this way. |
| `GUIDE.md` | The player's guide: everything the game does, by section (the README keeps only a short overview). |
| `FURNITURE.md` | Furniture models and room layout templates. |
| `ART.md` | Art direction: the cozy 3D look, palette, readability rules. |

**When documents disagree:** `DECISIONS.md` and the plans' "Notes as built" win, then the catalogs (`ROOMS.md`, `EVENTS.md`, `PATHWAYS.md`), then `DESIGN.md`. The code and `data/*.json` are the truth for what's built.

## Working with Bryon

- Friendly, brief, conversational. Explain technical ideas concisely, ideally with an analogy.
- Ask 1–2 focused questions up front rather than long back-and-forth.
- When a design question comes up that the docs don't answer, propose a sensible default and ask, rather than inventing silently. Some areas are still undecided (audio, mid- and late-game balance, the roadmap past M10, rings 4–6); see "Still open" in `docs/DECISIONS.md`.
- Keep "Notes as built" in the current plan and `README.md` up to date as things are built.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| 2D view | PixiJS (the "unrolled" view of each floor ring) |
| 3D view | Three.js; the main view, reading the same data |
| UI | React, for menus, office visits, overlays, flow diagrams |
| Build | Vite |
| Tests | Vitest, focused on the simulation |

Web first. A move to Godot may come later, so keep the port cheap (see architecture rules).

## Architecture rules

1. **Brain and face.** The simulation (brain) knows nothing about rendering; the views (face) only read sim state and draw it. No DOM, Pixi or React imports inside the sim.
2. **The sim runs in a Web Worker** and posts state snapshots to the main thread. The main thread sends player commands (build, dig, set ordinance) back as messages.
3. **Deterministic ticks.** The sim advances in fixed ticks with a seeded RNG, so runs are reproducible and testable. Real-time speed controls (pause, 1x, 2x, 4x) just change how many ticks run per second.
4. **Data in JSON, not code.** Rooms, crops, resources, events, traits and ordinances live in `data/*.json`. Balancing means editing numbers, not code, and the files carry over to Godot unchanged. No magic numbers in sim code.
5. **One model, two cameras.** 2D and 3D are two views of the same room coordinates.

Layout:

```
src/
  sim/        # pure TypeScript simulation; runs in the worker
  worker/     # worker entry point and message protocol
  render2d/   # PixiJS unrolled and plan views
  render3d/   # Three.js view: rooms, furniture, lights, sky, effects
  view/       # view helpers shared by 2D and 3D (furnishing, grime, labels, font)
  ui/         # React panels and overlays
  audio/      # synthesized sound
  devtools/   # the furnishing tool (?furnish)
data/         # rooms.json, crops.json, condition.json, furniture.json, layouts.json ...
docs/         # design docs, catalogs and milestone plans
scripts/      # furniture models, room status, elevation data, packaging
tests/        # Vitest: sim units plus scripted playthroughs (bots)
```

## Core spatial model

- A hole has a **diameter** and a stack of **floors**, dug by the drill. Each floor has up to 6 **rings** of room slots around the shaft; ring 1 faces the shaft. Only rings 1–3 are open so far.
- A room's position is **(floor, ring, slot)**. Rings are loops with no edges, so slot indices wrap.
- **Slots per ring** grow with radius (room depth d = slot width w = 10 m, shaft radius R):
  `slots(n) = round(2π · (R + (n − 0.5) · d) / w)`
  The starter hole is R = 10 m: rings 1–3 have 9, 16 and 22 slots. Adjacency across rings is by angular overlap.
- **Room footprints** have width (slots), depth (rings) and height (floors). Sizes: S = 1 slot, M = 2, L = 4, H = 8 (H not built yet).
- **Space is dug:** every slot is rock until a room (or an empty room) is excavated there.
- **Access:** the shaft is open to Mars. **Corridors run along the edges** between rooms (and between rooms and rock), not in slots; along the shaft wall they're glass **gallery tubes** (floor 1 starts with one all the way round; deeper floors get what the player builds). Every room needs a tube, corridor or walk-through room along one side. People reach floor 1 through the entrance, and deeper floors by stairs and elevators.
- **Neighbor effects** (noise, smell, health, comfort) radiate from rooms with a strength (−3 to +3) and radius in slots, falling off with distance, along the ring, across rings and between floors; corridors block noise. **Airborne effects** (air quality, smell) ride the network instead, fading per step. **Amenities and services** (parks, plazas, gyms, galleys, clinics, schools) count by walking distance in steps (10 m).

## Where things stand (Oct 4, 2026)

Milestones 1–14 are built: one hole growing into a network of two or more, a 3D view (the main one) with 2D and plan views, people with life stages, corridors on edges, construction time, storage, excavation and the entrance, furnished rooms, room condition with maintenance and cleaning, and (M11) a sealed network: the shaft is open to Mars, people move through gallery tubes, corridors and stairs, air and smell ride that network, and amenities and services count by walking distance (`sim/paths.ts`, `sim/amenities.ts`, `sim/care.ts`); (M12) bulkheads, airlock dust, crowding, glass, and the shaft dome as a hole's end goal; (M13) doors on any wall and windows as an upgrade; (M14) events with choices (`sim/events.ts`, `data/events.json`): what the drill strikes, a belt ship in distress, celebrations. 1× is 2 ticks a second, 240 ticks a game day, which the player sees as a month (T-021: `src/view/months.ts`). See the README for how to play, `DECISIONS.md` for what was decided while building, and `ROOM-STATUS.md` for what to build next.

**The Godot viewer** (`godot/`, C#) is close to parity with the web game. The TypeScript sim runs in Node (`src/bridge/`, `npm run bridge`) and Godot draws it; the bridge reuses the web's own code wherever it can (scene building, plan drawing, panel text) rather than porting it. Shared view logic lives in `src/view/` (`roomPanel.ts`, `roomCard.ts`, `hudItems.ts`, `corridorProposal.ts`) and `render2d/planDraw.ts`, used by both the React UI and the bridge. What's left is in `docs/PLAN-GODOT.md` under "Status and next".

Before committing, run `npm test` (unit tests plus scripted playthroughs) and check the change in the browser at http://localhost:5173. To test without touching Bryon's own browser game, open the same server at http://[::1]:5173: a different origin, so its saves (in local storage) are separate. On the dev server the menu shows the git branch being served (`git: …`, bottom left, opposite the version), so it's clear which checkout or worktree a tab is running; built games leave it out. `src/bridge` is type-checked separately: `npx tsc --noEmit -p tsconfig.node.json` (the main `tsconfig.json` leaves it out). For Godot changes, `cd godot && dotnet build`, and check them with a test run (see "Testing the viewer" in `PLAN-GODOT.md`).

## Playtest notes and the board

Bryon's playtest notes flow through seven skills (`.claude/skills/`). `docs/WORKFLOW.md` walks through the stages, with a diagram, and says why it works this way.

| Skill | Does |
| --- | --- |
| `/note <text>` | Adds the note verbatim to the inbox. Nothing else. |
| `/ingest` | Turns inbox notes into tickets in `docs/tickets/` (`T-012`, with size S/M/L/XL and open questions) or, for big items, features (`F-001`), archives each note word for word, and publishes them to main. |
| `/board` | Shows features with their tasks, then what's ready, needs answers, blocked, in flight and in review. "agree F-001" turns a feature's breakdown into tickets. |
| `/deps [days]` | Draws the ticket dependency tree in the Claude UI: tickets as boxes (ready purple, blocked gray, in flight or review blue, done green) with arrows for `blocked_by`; done tickets stay on it for `days` after shipping (default 7). From `node scripts/board.mjs graph`. |
| `/build [T-012]` | One ticket → overlap check against open PRs → a `t-012-…` branch from a fresh `origin/main` in a worktree → build, test, docs → PR. `/build F-001` writes or revises a feature's plan instead (a doc-only PR on `f-001-…`). |
| `/try [T-012] [web\|godot\|both]` | Starts the web dev server (on its own port from 5174), the Godot viewer (its bridge on a port from 7980, saving to a scratch folder), or both, for that ticket's (or branch's) worktree in the Terminal panel (`scripts/try.mjs` picks the checkout and ports), and says what to look at. Feedback you give afterwards goes on that PR as a checklist and gets fixed on the same branch. |
| `/land [T-012]` | After review: squash-merges the PR if CI is green, stops that branch's dev servers, removes its worktree, deletes its local and remote branches, updates main and shows what's ready next (`scripts/land.mjs`). With nothing named, sweeps up everything already merged. Leaves alone worktrees a live session is in, uncommitted work and branches still in flight. |

Tickets are checked in (`docs/tickets/`, see its README) and store only `open`, `done` or `dropped`; the rest is derived from GitHub (a pushed `t-0NN-…` branch is in flight, an open PR in review, a merged one done). **Features** (`F-0NN`) hold the plan for a big item; their tasks name them with `feature: F-0NN`, wait until Bryon agrees the feature, and read it first when built. A feature can be built on a branch of its own (`feature/f-0NN-…`) and land on main last. Ids can be shorthand in commands and chat (`t6` is T-006, `f1` is F-001); files, branches and commits use the full form. `node scripts/board.mjs publish` commits ticket-only changes straight to main. The inbox and the generated `BOARD.md` stay local, in `.tracker/` (gitignored). Doc changes for an item ride in its PR. A SessionStart hook (`.claude/hooks/fresh-main.sh`) fetches `origin/main` at the start of every session and fast-forwards a clean `main`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) (adopted Oct 4, 2026; older history doesn't follow it): `type(scope): summary`, with the ticket id at the end when there is one.

```
fix(render3d): light only the glazed room's half of the corridor on hover (T-003)
```

- **type**: `feat` (something new for the player), `fix` (a bug), `perf`, `refactor` (no behavior change), `test`, `docs` (docs only), `style` (formatting only), `build` (packaging, dependencies, Vite), `chore` (tooling, scripts, skills, tickets), `revert`. Balance changes in `data/*.json` are `feat` or `fix` with scope `balance`.
- **scope** (optional, one word): the area, as in tickets: `sim`, `data`, `ui`, `render3d`, `render2d`, `godot`, `bridge`, `audio`, `docs`, `balance`, `events`, `rooms`, `tickets`, `devtools`.
- **summary**: imperative and lowercase ("add", not "added" or "adds"), no full stop, about 72 characters at most. Put the why and the details in the body.
- A breaking change to saves or the bridge protocol gets a `!` (`feat(sim)!: …`) and a `BREAKING CHANGE:` line in the body.
- PR titles follow the same format.

Several sessions may work on the game at once: keep each to one area, on its own branch or worktree, and update the docs and commit as you finish so the others can see what changed.
