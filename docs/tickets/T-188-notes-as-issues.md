---
id: T-188
title: Notes become issues, and /ingest turns them into tickets on GitHub
status: done
size: M
area: docs
touches: [.claude/skills/note/SKILL.md, .claude/skills/ingest/SKILL.md, scripts/board.mjs]
blocked_by: [T-187]
feature: F-020
notes: []
created: 2026-10-26 19:02
---
## Problem
The inbox is local to each machine. Notes should be issues labeled `note`, so one can come from the phone app too.

## Context
F-020's Design, "Notes". The note text stays verbatim as the issue body.

As built: a note is any open issue that isn't a task or feature, not only one labeled `note`, so an issue jotted bare in GitHub's phone app counts too. The repo is public, so `notes` names each note's author and flags anyone but the owner; /ingest treats those as a stranger's text. Commands: `note`, `notes`, `ingest-done` (closes each waiting note an item lists, commenting "→ T-0NN (#N)" or "→ #N"), `close-note #N <why>` (closed as not planned, "→ no ticket: …"), and `--notes` on `new` and `log`. Issue templates for notes, tasks and features are in `.github/ISSUE_TEMPLATE/`; GitHub only offers them from the default branch, so they show up once the feature reaches main. Screenshots can't be attached through the API: /note keeps them in the local tracker and says to drag them onto the issue. Tried with throwaway issues #320–#322, all closed now.

## Approach
`/note` creates a `note` issue (first few words as the title). `/ingest` reads open notes, creates issues from a ticket template (Problem, Context, Approach, Docs to update, Open questions), links both ways, and closes each note with "→ #N". Remove the `.tracker/` inbox commands (note, inbox, ingest-start, ingest-done). Done: a note made on github.com shows up in `/ingest`.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
- 2026-10-26 20:05 building on t-188-notes-as-issues
- 2026-10-26 20:50 built
