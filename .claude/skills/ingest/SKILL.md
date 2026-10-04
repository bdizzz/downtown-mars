---
name: ingest
description: Turn the playtest-note inbox into tickets (or, for big items, features) in docs/tickets/ on the Downtown Mars board, archiving each note verbatim, then publish them to main. Use when Bryon types /ingest or asks to process his notes.
---

# /ingest

Turns the notes in the local inbox into **tickets** (and, for items too big to build without a plan, **features**): one markdown file each in `docs/tickets/`, checked in so any machine can build them. Each note is archived word for word in `docs/tickets/notes-archive.md`. Ingesting touches nothing outside `docs/tickets/`; doc changes for an item happen in the PR that builds it.

`node scripts/board.mjs` works on the main checkout's tickets wherever you run it from.

## Steps

1. `node scripts/board.mjs ingest-start`. It moves the inbox aside, gives each note an id (`N-0001`…), appends it to the archive, and prints the notes and the next free ticket and feature ids. If it says it's resuming, some tickets from the last run may already exist; check before creating duplicates.
2. Read what you need to understand the notes: `node scripts/board.mjs menu` for the existing tickets and features, and only as much of the repo as it takes to judge the area, size and likely files (CLAUDE.md, `docs/DECISIONS.md`, a grep or two). Keep this light; the build session does the real investigation.
3. For each note, decide:
   - **New ticket**: a bug, a tweak, a feature, a balance change or a doc/design decision.
   - **New feature**: an XL item that needs a plan before anything can be built (a new system, a reworked model, a milestone's worth). See step 4b.
   - **Add to an open ticket or feature**: the same problem seen again, or more detail. Add to its body (a feature's Design or Breakdown), add the note id to `notes`, and log it: `node scripts/board.mjs log T-0NN "added N-0034"` (or `F-0NN`). Something that belongs to an agreed feature as a new task becomes a ticket with `feature: F-0NN`, plus a Breakdown line "… → T-0NN"; for a draft feature, add the Breakdown line only.
   - **Split**: one note holding several unrelated things becomes several tickets, each listing the same note id.
   - **No ticket**: pure praise, or something already done. Say so in the summary; the archive keeps it.
   If a note goes against `docs/DECISIONS.md` (say, a reversal it lists as not to revive), still make the ticket, but put the conflict in its open questions.
4. Write each new ticket to `docs/tickets/T-0NN-<short-slug>.md` (in the main checkout; `node scripts/board.mjs path` prints `<main>/.tracker`), numbering from the next free id:

   ```markdown
   ---
   id: T-012
   title: Drill button hidden behind the room panel
   status: open             # open · done · dropped. Everything else (needs answers, blocked, in flight, in review) is worked out live
   size: S                  # S: an hour or so, a file or two · M: a focused session · L: several systems · XL: needs a plan of its own
   area: ui                 # one or two of: sim, data, ui, render3d, render2d, godot, bridge, audio, docs, balance, events, rooms
   touches: [src/ui/RoomPanel.tsx]   # likely files or folders; a guess is fine
   blocked_by: []           # ticket ids or PR numbers (#41)
   feature: F-003           # only for a task of a feature; leave the line out otherwise
   notes: [N-0031]
   created: 2026-10-04 14:02    # now, as YYYY-MM-DD HH:MM
   ---
   ## Problem
   What Bryon saw or wants, in a sentence or three. Quote his phrasing where it matters.

   ## Context
   Anything that helps whoever builds it: where the code is, related tickets or decisions, how to reproduce. Grows over time; this file is the place to elaborate rather than the shared docs.

   ## Approach
   A likely way to do it, and what "done" looks like. Brief; the build session decides.

   ## Docs to update
   Which docs the PR should change, e.g. "DECISIONS.md: dust no longer affects gyms", "GUIDE.md: Drilling". Leave out if none.

   ## Open questions
   - [ ] Questions only Bryon can answer. Leave the section out if there are none. Ticking them all (or removing the section) makes the ticket ready.

   ## History
   - 2026-10-04 14:02 opened from N-0031
   ```

   Sizes are for picking quick wins, so be honest: if it touches the sim and the UI and needs tests, it isn't an S. Something that would be an XL is usually a feature instead (4b).

   **4b. Features.** Write a new feature to `docs/tickets/F-0NN-<short-slug>.md`, numbering from the next free feature id (`node scripts/board.mjs next-id F`). It's the epic: the plan lives here, and its tasks become tickets only once Bryon agrees it (`docs/tickets/README.md`).

   ```markdown
   ---
   id: F-005
   title: Cave-ins and shoring
   status: draft            # draft · agreed · done · dropped
   plan:                    # left empty; /build F-0NN may write a docs/PLAN-M*.md and link it here
   notes: [N-0031]
   created: 2026-10-04 14:02
   ---
   ## Goal
   What Bryon wants and why, in a few sentences. Quote his phrasing where it matters.

   ## Design
   What's decided so far, his ideas as he gave them, and the context a task would need (code, decisions it touches).

   ## Breakdown
   Proposed; becomes tickets once this feature is agreed.
   - One line per likely task, in build order, each small enough for one PR. A rough first cut is fine; /build F-0NN refines it.

   ## Open questions
   - [ ] As for tickets.

   ## History
   - 2026-10-04 14:02 opened from N-0031
   ```
5. `node scripts/board.mjs ingest-done`. It links each archived note to its tickets and features, and clears the ingest file. If it lists a note as "no ticket" that should have one, fix it and run it again.
6. Publish: `node scripts/board.mjs publish "chore(tickets): add T-012–T-015 from N-0031–N-0034"` plus a blank line and the attribution line from the system reminder. It commits only `docs/tickets/` on main and pushes it. If it refuses (main isn't on `main`, or has unpushed commits), tell Bryon. The tickets are safe on disk; publish again once that's sorted.
7. Summarize in a few lines: the tickets and features made or updated (id, size, title; for a feature, its proposed breakdown in a line), notes with no ticket and why, then **the open questions**, numbered, so Bryon can answer them in one reply. When he answers: fold the answers into the tickets (tick the questions, update Problem/Approach), `log T-0NN "questions answered"`, and publish again.
