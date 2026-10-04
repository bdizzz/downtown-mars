---
name: ingest
description: Turn the playtest-note inbox into tickets in docs/tickets/ on the Downtown Mars board, archiving each note verbatim, then publish them to main. Use when Bryon types /ingest or asks to process his notes.
---

# /ingest

Turns the notes in the local inbox into **tickets**: one markdown file each in `docs/tickets/`, checked in so any machine can build them. Each note is archived word for word in `docs/tickets/notes-archive.md`. Ingesting touches nothing outside `docs/tickets/`; doc changes for an item happen in the PR that builds it.

`node scripts/board.mjs` works on the main checkout's tickets wherever you run it from.

## Steps

1. `node scripts/board.mjs ingest-start`. It moves the inbox aside, gives each note an id (`N-0001`…), appends it to the archive, and prints the notes and the next free ticket id. If it says it's resuming, some tickets from the last run may already exist; check before creating duplicates.
2. Read what you need to understand the notes: `node scripts/board.mjs menu` for the existing tickets, and only as much of the repo as it takes to judge the area, size and likely files (CLAUDE.md, `docs/DECISIONS.md`, a grep or two). Keep this light; the build session does the real investigation.
3. For each note, decide:
   - **New ticket**: a bug, a tweak, a feature, a balance change or a doc/design decision.
   - **Add to an open ticket**: the same problem seen again, or more detail. Add to its body, add the note id to `notes`, and log it: `node scripts/board.mjs log T-0NN "added N-0034"`.
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

   Sizes are for picking quick wins, so be honest: if it touches the sim and the UI and needs tests, it isn't an S. An XL usually means a milestone: say so in Approach (it may want its own `docs/PLAN-M*.md`).
5. `node scripts/board.mjs ingest-done`. It links each archived note to its tickets and clears the ingest file. If it lists a note as "no ticket" that should have one, fix it and run it again.
6. Publish: `node scripts/board.mjs publish "chore(tickets): add T-012–T-015 from N-0031–N-0034"` plus a blank line and the attribution line from the system reminder. It commits only `docs/tickets/` on main and pushes it. If it refuses (main isn't on `main`, or has unpushed commits), tell Bryon. The tickets are safe on disk; publish again once that's sorted.
7. Summarize in a few lines: the tickets made or updated (id, size, title), notes with no ticket and why, then **the open questions**, numbered, so Bryon can answer them in one reply. When he answers: fold the answers into the tickets (tick the questions, update Problem/Approach), `log T-0NN "questions answered"`, and publish again.
