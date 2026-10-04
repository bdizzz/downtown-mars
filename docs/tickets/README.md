# Tickets

One file per item from Bryon's playtest notes, made by `/ingest` and built by `/build` (skills in `.claude/skills/`). Each ticket is the place to elaborate on that item: its problem, context, approach, docs to update, open questions and history. Shared docs change only when the item is built.

- `T-0NN-<slug>.md`: the tickets. They store `status: open | done | dropped`. Everything else is worked out live by `node scripts/board.mjs menu`: open questions mean "needs answers", unfinished `blocked_by` means "blocked", a pushed `t-0NN-…` branch means "in flight", an open PR from one means "in review", and a merged PR means "done".
- `notes-archive.md`: every note verbatim, with the tickets it became.

The inbox of unprocessed notes and the generated `BOARD.md` stay local to each machine, in `.tracker/` (gitignored).
