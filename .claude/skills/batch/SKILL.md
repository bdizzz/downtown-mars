---
name: batch
description: Build several Downtown Mars tickets at once, each in a session of its own running /build — picks ready tickets that don't overlap each other or open PRs, asks every open question across the batch up front, bundles tickets that will likely edit the same files into one branch and PR, starts one desktop-app session per ticket or bundle, then reports their PRs as they come in. Use when Bryon types /batch, or asks to build several tickets, quick wins or a feature's ready tasks in parallel.
---

# /batch [N | quick wins | #a #b … | feature #N] [ship]

Each ticket still gets the full `/build`: its own branch, worktree, PR and preview. This skill only picks the tickets, asks their open questions in one go, bundles the ones that would fight over the same files, and starts the sessions. Think of it as the pass in a kitchen sending tickets to several cooks at once.

- **N** (default 3, at most 4): how many sessions. More than four is more PRs than Bryon can review in one sitting; say so if he asks for more, and start four.
- **quick wins**: only Ready tickets of size S.
- **#a #b …**: those tickets, no picking.
- **feature #N**: that feature's Ready tasks (`node scripts/board.mjs show #N` lists them).
- **ship**: each session runs `/build #N ship`, so its PR merges itself once CI passes. Only when Bryon says it.

## 1. Pick

1. `node scripts/board.mjs menu`. Take candidates from its Ready list, in its order (small and old first), unless Bryon named them. If notes are waiting, say so once; don't ingest.
2. For each candidate, `node scripts/board.mjs show <id>`: its area, `touches`, Approach, Open questions, and the feature it belongs to. Named tickets that are blocked or already in flight: say which and leave them out. Named tickets that **need answers** stay in: their questions go into step 3.
3. **Questions first, all at once.** Before starting any session, gather every open question across the batch in one place:
   - unticked `- [ ]` lines under a candidate's Open questions (named Needs-answers tickets, and any a Ready ticket still carries);
   - anything you noticed reading them that a session would otherwise stop and ask about: an Approach with two readings, a choice the docs don't settle (see "Still open" in `docs/DECISIONS.md`), or a detail that decides **which files** a ticket touches, and so whether it bundles with another.

   Ask them together, grouped by ticket (`#437: …`), each with your proposed default so Bryon can just say "defaults". Use `AskUserQuestion` for up to four questions with clear options; for more, list them numbered in chat and end the turn. Start nothing until he answers: one round of questions here beats four sessions each stopping to ask. Fold the answers into each ticket as `/board`'s "answer questions" does (tick the questions, fold the answer into Problem or Approach, `node scripts/board.mjs log <id> "questions answered"`), so the session that builds it reads them. If a ticket's answers make it bigger or murkier, leave it for the next batch. No questions at all: say so in a word and go on.
4. **Overlap and bundling**, the same quick conceptual check `/build` does (step 2 there), but across the batch too, now that the answers are in:
   - against open PRs: `gh pr list --state open --json number,title,headRefName,files --jq '.[] | {number, title, headRefName, files: [.files[].path]}'`. A candidate that overlaps an open PR waits for the next batch.
   - against each other: from `touches`, the Approach and a quick look at the code, which tickets will **likely edit the same files** (the same component, the same sim system, the same data file, the same doc section)?
   Every PR bumps `package.json`'s version; that line doesn't count as overlap (`/land` re-bumps whichever lands second).

   **Bundle them.** Tickets likely to edit the same files go to **one** session and one branch and PR, as `/build #a #b`, rather than one waiting for the next batch. That's your call to make, not Bryon's: two cooks at one cutting board just bump elbows. Bundle freely when tickets share files, whether or not they share a feature (tasks of one feature, a bug and its follow-up, two tweaks to the same panel); Bryon has done it by hand before (#183 + #184 + #186). Keep a bundle reviewable: at most three tickets and about an L of work in total; never bundle an XL. When a bundle would be too big, keep the first tickets and leave the rest for the next batch. A bundle counts as one session toward N.
5. If Bryon named the tickets and nothing changed, go on. Otherwise show the plan in one line each (`#437 S` title; bundles as `#183 + #184` with the shared files in a few words, e.g. "both edit `RoomPanel.tsx`"), and what you left out and why, then start them unless he says otherwise in the same breath.

## 2. Start the sessions

Call `mcp__ccd_session__mark_chapter` with a short title ("Batch: 3 quick wins"), then for each ticket or bundle, one `mcp__ccd_session__start_session` (load with ToolSearch `select:mcp__ccd_session__start_session,mcp__ccd_session__mark_chapter` if needed), all in one message, each preceded by a bold title line and one sentence:

- `initiation`: `"user_asked"` (Bryon asked for the batch)
- `context`: `"fresh"`, `use_worktree`: `true` (each gets its own worktree and branch)
- `title`: `#437: <ticket title>` (a bundle: `#183 + #184: <first title>`)
- `name`: `b-437` (a bundle: `b-183-184`)
- `branch_name`: `build-437` (a bundle: `build-183-184`)
- `prompt`: `/build #437` (a bundle: `/build #183 #184`; add ` ship` if he said ship). Then one line on what else is in this batch, so it doesn't reach into those tickets' files: "Running alongside #438 and #440 in other sessions; stay out of their files: …".
- `background`: one or two sentences: this is one ticket (or bundle) of a parallel batch on the Downtown Mars board; its open questions were answered on the ticket before the batch started; `/build` (`.claude/skills/build/SKILL.md`) is the whole recipe; stop and ask in that session if the ticket turns out bigger than its size or raises a design question.

Leave out `model` and `effort`: builds want the same model as here.

## 3. While they run

Tell Bryon in a few lines: what started (link each session, `[#437: title](#local_…)`, from the tool result), what was left out, and that he can open any of them to steer it. Then end the turn; don't poll.

The app wakes this session when they finish their turns. For each note that arrives:

- **A PR opened**: check it's real (`gh pr view <N> --json number,title,url,state`), then one line: PR link, its preview (`https://mars.bryon.site/preview/<N>/`), anything the session said to look at.
- **Stopped with a question**: pass it on in a line, linking the session; Bryon answers there.
- **Failed**: say so, with what it said.

When every session has reported, finish with what's ready to review and the next step: `/try #N` for anything visible, `/land #N` (or `/land` once they've merged, with ship). Don't merge or try anything yourself: those are his calls, one PR at a time.
