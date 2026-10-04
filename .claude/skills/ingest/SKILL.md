---
name: ingest
description: Turn the playtest-note inbox into item cards on the Downtown Mars board, archiving each note verbatim. Use when Bryon types /ingest or asks to process his notes.
---

# /ingest

Turns notes in the inbox into **item cards** in the tracker (`node scripts/board.mjs path`; `items/` there). The notes themselves are archived word for word in `notes-archive.md`. Ingesting does not touch the repo: no doc edits, no commits. Doc changes happen in the PR that builds an item.

## Steps

1. `node scripts/board.mjs ingest-start`. It moves the inbox aside, gives each note an id (`N-0001`…), archives it, and prints the notes and the next free card id. If it says it's resuming, some cards from the last run may already exist; check `items/` before creating duplicates.
2. Read what the notes need to be understood: `node scripts/board.mjs menu` for the existing cards, and only as much of the repo as you need to judge the area, size and likely files (CLAUDE.md, `docs/DECISIONS.md`, a grep or two). Keep this light; the build session does the real investigation.
3. For each note, decide:
   - **New card**: a bug, a tweak, a feature, a balance change or a doc/design decision.
   - **Add to an existing card** that isn't done yet: same problem seen again, or more detail. Append to its body, add the note id to `notes`, and if the card was `ready` and the note raises a question, move it to `noted`.
   - **Split**: one note holding several unrelated things becomes several cards, each listing the same note id.
   - **No card**: pure praise, or something already done. Say so in the summary; the archive keeps it.
   If a note contradicts `docs/DECISIONS.md` (a reversal it lists as not to revive), still make the card, but put the conflict in its open questions.
4. Write each new card to `items/T-0NN-<short-slug>.md`, numbering from the next free id:

   ```markdown
   ---
   id: T-012
   title: Drill button hidden behind the room panel
   status: ready            # ready if no open questions, else noted
   size: S                  # S: an hour or so, a file or two · M: a focused session · L: several systems · XL: needs a plan of its own
   area: ui                 # one or two of: sim, data, ui, render3d, render2d, godot, bridge, audio, docs, balance, events, rooms
   touches: [src/ui/RoomPanel.tsx]   # likely files or folders; a guess is fine
   blocked_by: []
   pr:
   branch:
   notes: [N-0031]
   created: 2026-10-04 14:02    # now, as YYYY-MM-DD HH:MM
   updated: 2026-10-04 14:02
   ---
   ## Problem
   What Bryon saw or wants, in a sentence or three. Quote his phrasing where it matters.

   ## Approach
   A likely way to do it, and what "done" looks like. Brief; the build session decides.

   ## Docs to update
   Which docs the PR should change, e.g. "DECISIONS.md: dust no longer affects gyms", "GUIDE.md: Drilling". Leave out if none.

   ## Open questions
   - [ ] Questions only Bryon can answer. Leave the section out if there are none.

   ## History
   - 2026-10-04 14:02 → ready (from N-0031)
   ```

   Sizes are for picking quick wins, so be honest: if it touches the sim and the UI and needs tests, it isn't an S. An XL usually means a milestone: say so in Approach (it may want its own `docs/PLAN-M*.md`).
5. `node scripts/board.mjs ingest-done`. It links each archived note to its cards, clears the ingesting file and rewrites BOARD.md. If it lists a note as "no card" that should have one, fix it and run it again.
6. Summarize in a few lines: the cards made or updated (id, size, title), notes with no card and why, then **the open questions**, numbered, so Bryon can answer them in one reply. When he answers, edit the cards: tick or remove the questions, fold the answers into Problem/Approach, and `node scripts/board.mjs move T-0NN ready --why "questions answered"`.
