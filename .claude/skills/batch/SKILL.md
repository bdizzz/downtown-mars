---
name: batch
description: Build several Downtown Mars tickets at once, each in a session of its own running /build — picks ready tickets that don't overlap each other or open PRs, starts one desktop-app session per ticket (or per group that belongs together), then reports their PRs as they come in. Use when Bryon types /batch, or asks to build several tickets, quick wins or a feature's ready tasks in parallel.
---

# /batch [N | quick wins | #a #b … | feature #N] [ship]

Each ticket still gets the full `/build`: its own branch, worktree, PR and preview. This skill only picks the tickets, checks they won't fight, and starts the sessions. Think of it as the pass in a kitchen sending tickets to several cooks at once.

- **N** (default 3, at most 4): how many sessions. More than four is more PRs than Bryon can review in one sitting; say so if he asks for more, and start four.
- **quick wins**: only Ready tickets of size S.
- **#a #b …**: those tickets, no picking.
- **feature #N**: that feature's Ready tasks (`node scripts/board.mjs show #N` lists them).
- **ship**: each session runs `/build #N ship`, so its PR merges itself once CI passes. Only when Bryon says it.

## 1. Pick

1. `node scripts/board.mjs menu`. Take candidates from its Ready list, in its order (small and old first), unless Bryon named them. If notes are waiting, say so once; don't ingest.
2. For each candidate, `node scripts/board.mjs show <id>`: its area, `touches`, Approach, and the feature it belongs to. Named tickets that aren't Ready (needs answers, blocked, in flight): say which and leave them out.
3. **Overlap**, the same quick conceptual check `/build` does (step 2 there), but across the batch too:
   - against open PRs: `gh pr list --state open --json number,title,headRefName,files --jq '.[] | {number, title, headRefName, files: [.files[].path]}'`
   - against each other: the same files, the same data file or the same system means they'd conflict.
   Every PR bumps `package.json`'s version; that line doesn't count as overlap (`/land` re-bumps whichever lands second).
   Two Ready tickets that overlap but **belong together** (tasks of one feature touching the same files, a bug and its follow-up) go to **one** session as `/build #a #b`, the way Bryon has bundled them before (#183 + #184 + #186). Otherwise keep the first and leave the other for the next batch.
4. If Bryon named the tickets, go on. If you picked them, show the list in one line each (`#437 S` title, and any bundles), and what you left out and why, then start them unless he says otherwise in the same breath. Ask only if something is genuinely unclear.

## 2. Start the sessions

Call `mcp__ccd_session__mark_chapter` with a short title ("Batch: 3 quick wins"), then for each ticket or bundle, one `mcp__ccd_session__start_session` (load with ToolSearch `select:mcp__ccd_session__start_session,mcp__ccd_session__mark_chapter` if needed), all in one message, each preceded by a bold title line and one sentence:

- `initiation`: `"user_asked"` (Bryon asked for the batch)
- `context`: `"fresh"`, `use_worktree`: `true` (each gets its own worktree and branch)
- `title`: `#437: <ticket title>` (a bundle: `#183 + #184: <first title>`)
- `name`: `b-437` (a bundle: `b-183-184`)
- `branch_name`: `build-437`
- `prompt`: `/build #437` (a bundle: `/build #183 #184`; add ` ship` if he said ship). Then one line on what else is in this batch, so it doesn't reach into those tickets' files: "Running alongside #438 and #440 in other sessions; stay out of their files: …".
- `background`: one or two sentences: this is one ticket of a parallel batch on the Downtown Mars board; `/build` (`.claude/skills/build/SKILL.md`) is the whole recipe; stop and ask in that session if the ticket turns out bigger than its size or raises a design question.

Leave out `model` and `effort`: builds want the same model as here.

## 3. While they run

Tell Bryon in a few lines: what started (link each session, `[#437: title](#local_…)`, from the tool result), what was left out, and that he can open any of them to steer it. Then end the turn; don't poll.

The app wakes this session when they finish their turns. For each note that arrives:

- **A PR opened**: check it's real (`gh pr view <N> --json number,title,url,state`), then one line: PR link, its preview (`https://mars.bryon.site/preview/<N>/`), anything the session said to look at.
- **Stopped with a question**: pass it on in a line, linking the session; Bryon answers there.
- **Failed**: say so, with what it said.

When every session has reported, finish with what's ready to review and the next step: `/try #N` for anything visible, `/land #N` (or `/land` once they've merged, with ship). Don't merge or try anything yourself: those are his calls, one PR at a time.
