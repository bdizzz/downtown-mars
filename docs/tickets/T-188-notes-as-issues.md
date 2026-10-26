---
id: T-188
title: Notes become issues, and /ingest turns them into tickets on GitHub
status: open
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

## Approach
`/note` creates a `note` issue (first few words as the title). `/ingest` reads open notes, creates issues from a ticket template (Problem, Context, Approach, Docs to update, Open questions), links both ways, and closes each note with "→ #N". Remove the `.tracker/` inbox commands (note, inbox, ingest-start, ingest-done). Done: a note made on github.com shows up in `/ingest`.

## History
- 2026-10-26 19:02 opened from F-020 (agreed)
