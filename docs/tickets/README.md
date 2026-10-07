# Tickets

One file per item from Bryon's playtest notes, made by `/ingest` and built by `/build` (skills in `.claude/skills/`; `docs/WORKFLOW.md` walks through the whole flow). Each ticket is the place to elaborate on that item: its problem, context, approach, docs to update, open questions and history. Shared docs change only when the item is built.

- `T-0NN-<slug>.md`: the tickets. They store `status: open | done | dropped`. Everything else is worked out live by `node scripts/board.mjs menu`: open questions mean "needs answers", unfinished `blocked_by` (or a feature still in draft) means "blocked", a pushed `t-0NN-…` branch means "in flight", an open PR from one means "in review", and a merged PR means "done".
- `F-0NN-<slug>.md`: the **features** (epics), for items too big to build from one ticket. See below.
- `notes-archive.md`: every note verbatim, with the tickets and features it became.

The inbox of unprocessed notes and the generated `BOARD.md` stay local to each machine, in `.tracker/` (gitignored).

## Features

A feature holds the plan for a big item, and how it breaks into tasks, so each task ticket can assume that context and focus on its own job.

```markdown
---
id: F-001
title: Water as a closed loop
status: draft            # draft · agreed · done · dropped
plan:                    # optional: docs/PLAN-M*.md once the design outgrows this file
branch:                  # optional: feature/f-0NN-<slug>, when its tasks are built on a branch of its own (see below)
notes: [N-0005]
created: 2026-10-04 19:12
---
## Goal
## Design
## Breakdown
- The planned tasks, one line each; "→ T-0NN" once a line becomes a ticket
## Open questions
- [ ] As in tickets
## History
```

- **Draft** while it's being worked out: `/ingest` makes one for an XL item, and `/build F-0NN` writes or revises its plan as a doc-only PR on an `f-0NN-…` branch. Tasks that already exist wait (show as blocked) until it's agreed.
- **Agreed** once Bryon says so (`/board`: "agree F-001"). Then each Breakdown line without a ticket becomes one, with `feature: F-0NN`, and the line gets "→ T-0NN".
- The board shows it as **in progress** once a task is in flight, and **done** once every Breakdown line has a ticket and all of them are done or dropped (or set `status: done`).
- **On a branch of its own** (Bryon's choice when he agrees it, for a feature to test as a whole before it reaches main): `node scripts/board.mjs feature-branch F-0NN` makes `feature/f-0NN-<slug>` from main and records it as `branch:`. Its tasks still get a `t-0NN-…` branch and PR each, but branched from the feature branch, with the PR into it (`board.mjs base T-0NN` says which); `/land` squash-merges them there. `board.mjs sync F-0NN` merges main into the feature branch to keep it current. A draft PR from the feature branch into main gives a playable preview of the whole feature so far. The feature is **ready to merge** once every task is finished, and **done** only when that PR is merged (with a merge commit, so each task's commit is kept).
- A task's build reads its feature first: `node scripts/board.mjs show T-0NN` says which.
