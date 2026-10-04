---
id: T-012
title: Features (epics) on the board, parents of task tickets
status: open
size: M
area: docs
touches: [scripts/board.mjs, docs/tickets/README.md, .claude/skills/ingest/SKILL.md, .claude/skills/board/SKILL.md, .claude/skills/build/SKILL.md, CLAUDE.md]
blocked_by: []
notes: [N-0008]
created: 2026-10-04 19:30
---
## Problem
Big items like the water loop (T-005) and rooms by area (T-010) need planning before any task can be built. Bryon wants a **feature** entity, the Jira epic/story analog: the feature holds the plan and details, including **how to break the work into tasks**, so each task ticket can assume that context and focus on its own job. Task tickets for a feature **wait until the feature is committed to and agreed**.

## Context
- The board today: one file per ticket in `docs/tickets/`, status derived live from GitHub (`scripts/board.mjs`, 413 lines; skills `/ingest`, `/board`, `/build`; README in `docs/tickets/`).
- Candidate features now: water loop (T-005 with T-006, T-007), air mix (T-011), room materials (T-008), rooms by area (T-010). Each of those tickets says it "becomes a feature".

## Approach
Proposed shape (the build session can adjust):
- **`F-0NN-<slug>.md`** in `docs/tickets/`, frontmatter `id`, `title`, `status: draft | agreed | done | dropped`, `notes`, `created`; body: Goal, Design (or a link to its `docs/PLAN-M*.md`), **Breakdown** (the planned tasks, as a checklist that becomes tickets once agreed), Open questions, History.
- Tickets gain an optional `feature: F-0NN`. A task's build reads its feature file first.
- `/ingest` can make a feature instead of a ticket for XL items, and add notes to a feature. Once Bryon agrees a feature, its Breakdown turns into tickets.
- `/board` groups tickets under their feature and shows features as draft / agreed / in progress (from their tasks) / done.
- `/build F-0NN` writes or revises the feature's plan (a doc-only PR), rather than code.
- Migrate: T-005 → F-001 Water loop (tasks: loop, T-006, T-007), T-011 → Air mix, T-008 → Room materials and floors, T-010 → Rooms by area. Drop or fold the stand-in tickets as they become features.

Done: `node scripts/board.mjs menu` shows features with their tasks; the skills and README describe them.

## Docs to update
- `docs/tickets/README.md`, the three skills, CLAUDE.md (Playtest notes and the board).

## History
- 2026-10-04 19:30 opened from Bryon's answer on T-010 (N-0008)
