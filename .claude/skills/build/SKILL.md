---
name: build
description: Implement one ticket from the Downtown Mars playtest board end to end — check open PRs for overlap, branch from a fresh main in a worktree, build, test, update docs, push and open a PR. Or, given a feature (F-001), write or revise its plan as a doc-only PR. Use when Bryon types /build, with a ticket id (T-012, #212, or shorthand like t12), a feature id (F-001, f1), a description, or nothing to pick from the menu.
---

# /build [#N … | feature #N | description]

One ticket, one branch, one PR (several ids only if Bryon lists them together; they share a branch and PR named after the first). Tickets are GitHub issues labeled `task` (features: `feature`). Their live state comes from GitHub: a pushed branch for the ticket means in flight, an open PR means in review, a merged PR (or the issue closed) means done. So the branch name matters.

**Ids and branch names.** Everything goes by issue number (`#212`) and builds on `212-<slug>`, the name GitHub's own "Create a branch" gives. The old ids from before the move to issues (`T-080`, `F-004`) still work as aliases, through `docs/ticket-ids.json`: `t80`, `T-080` and `f4` find their issue, and a bare `212` is issue 212. Use `#N` in the session title, commits and PR. Older branches (`t-080-…`, `f-004-…`) are still recognised, but new ones are always `<N>-<slug>`.

A **feature** (an issue labeled `feature`) builds its plan instead of code; see "Building a feature" at the end. A ticket that's a sub-issue of a feature (`show` says "Part of #109") is one of that feature's tasks: read the feature (`node scripts/board.mjs show #109`, and its plan doc if it has one) before the ticket, and treat its Design as settled.

Editing an issue's text is always: `node scripts/board.mjs body <id> > <scratch file>`, edit it, `node scripts/board.mjs set-body <id> <scratch file>`. Nothing about tickets is committed.

## 1. Pick the ticket

Run `node scripts/board.mjs menu`.

- **An id**: use it. **A description**: find the matching ticket in the menu and confirm it in one line before starting.
- **Nothing**: show the menu's Ready list and ask which. Understand "quick win" (the first Ready S; the menu lists small and old first), "oldest" and "answer questions" (as in /board).
- If the menu says notes are waiting, mention it once ("4 notes not on the board yet; /ingest first?"). Don't ingest unless he says so.

Then `node scripts/board.mjs show <id>` and read the ticket, including its Context and its history.

Name the session after it: load `mcp__ccd_session_mgmt__set_session_title` (ToolSearch `select:mcp__ccd_session_mgmt__set_session_title`) and set the title to `#212: <ticket title>` (for several tickets, `#212 + #214: <first title>`). Outside the desktop app the tool doesn't exist; skip it silently.

- **Needs answers**: ask the open questions, fold in the answers (as /board does), and continue.
- **In flight / in review**: another session or machine has it; say which branch or PR and ask before going on.
- **Blocked / done / dropped**: say so and stop unless Bryon says otherwise. A task blocked on its feature (`#106 (draft)`) waits for Bryon to agree the feature: offer `/build #106` or agreeing it in /board.

## 2. Check open PRs for overlap

```sh
gh pr list --state open --json number,title,headRefName,files --jq '.[] | {number, title, headRefName, files: [.files[].path]}'
```

Compare each open PR with the ticket's area, touches and Approach. It's a quick conceptual check, not a code review: the same files, the same data file, or the same system (both rework room layouts; both change how dust spreads) counts as overlap. Unrelated areas that both touch a big shared file like `src/sim/state.ts` in different places don't count.

If there's overlap, tell Bryon in one or two lines ("PR #41 (#132) rewrites `data/layouts.json`; #137 changes room layouts too, so they'll probably conflict") and ask: merge that first, go ahead anyway, or pick something else? If he defers it, record the block so every machine sees it:

```sh
node scripts/board.mjs log <id> "blocked: overlaps PR #41" --blocked-by "#132"   # or --blocked-by "#41" if the PR has no ticket
```

The ticket shows as ready again by itself once #132 is done. Then go back to step 1.

## 3. Branch from a fresh base

The branch is `<N>-<slug>` (e.g. `212-drill-button-hidden`). Its **base** is main, unless the ticket's feature is built on a branch of its own: `node scripts/board.mjs base <id>` prints which (`main`, or e.g. `feature/f-004-rooms-by-area`). Use that base wherever this skill says main below: the fetch, the branch point, the PR's `--base`, and the overlap check (PRs into the same feature branch overlap most).

- **A feature branch behind main**: bring main in first with `node scripts/board.mjs sync #109` (merges `origin/main` into the feature branch in a throwaway worktree and pushes it). If it reports a conflict, stop and tell Bryon which files; nothing was pushed.

- If this session is in the main checkout (`git rev-parse --git-dir` equals `--git-common-dir`), don't build there; it's where Bryon takes notes and plays. Load `EnterWorktree` (ToolSearch `select:EnterWorktree`) and enter a worktree named after the branch.
- In the worktree: `git fetch origin <base>` and `git switch -c <branch> origin/<base>`. If that fails because the worktree's branch already has commits of its own, stop and ask. (In an app-made worktree, use the `sync_with_base_branch` tool to bring in main later, not `git merge`.)
- **Claim it**: `git push -u origin <branch>` (the pushed branch is what shows the ticket as in flight on every machine), then `node scripts/board.mjs log <id> "building on <branch>"`, a comment on the issue.
- Install packages if `node_modules` is missing (`npm install`).

## 4. Build it

Work as CLAUDE.md says: brain and face, data in JSON, deterministic sim. Read only the docs the ticket points at, plus `docs/DECISIONS.md` if the change touches design. If you learn something worth keeping (a cause, a gotcha), add it to the ticket's Context on the issue; if it matters to the feature's other tasks, add it to the feature's Design instead. If the work turns out much bigger than the ticket's size, or raises a design question the docs don't answer, stop and ask rather than growing the PR. Bryon can split the ticket.

## 5. Check it

- `npm test` (unit tests and the scripted playthroughs). For `src/bridge` changes also `npx tsc --noEmit -p tsconfig.node.json`; for Godot, `cd godot && dotnet build` and a test run as in "Testing the viewer" in `docs/PLAN-GODOT.md`.
- Browser check for anything visible: start the dev server with preview_start and use **http://[::1]:5173**, never `localhost:5173`, so Bryon's own saves aren't touched. Take a screenshot of the change for the PR.
- If something can't be checked (a long-game balance effect, say), say so in the PR rather than skipping it silently.

## 6. Docs, commit, PR

- Update the docs the ticket lists under "Docs to update", plus whatever the change makes stale: "Notes as built" in the relevant plan, `docs/GUIDE.md` for player-visible changes, `docs/DECISIONS.md` for design decisions, and `node scripts/room-status.mjs` if rooms changed. The README only if its short overview changes.
- There's no ticket to mark done: the PR's `Closes #N` closes the issue when it merges into main, and `/land` closes it when it merges into a feature branch.
- Commit in small logical steps, in the Conventional Commits format from CLAUDE.md ("Commit messages"), e.g. `fix(ui): keep the drill button clear of the room panel (#212)`, ending each message with the attribution line from the system reminder. `git push`.
- Open the PR. Bryon is the only reviewer, so keep it short. `#N` is the ticket's issue number (`show` prints it; for several tickets, a `Closes` line each):

  ```sh
  gh pr create --base <base> --title "<type>(<scope>): <summary> (#212)" --body "$(cat <<'EOF'
  <one to three lines: what changed and why>

  **Preview:** [play this PR's build](https://mars.bryon.site/preview/PRNUM/) (works until the PR merges)

  Tested: <npm test, what was checked in the browser>
  Closes #N

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
- The PR's number only exists once it's open, so fill it into the preview link straight after: read the body (`gh pr view <N> --json body --jq .body`), swap `PRNUM` for the number, and `gh pr edit <N> --body-file <file>`. Keep the description current if review changes what the PR does.
- Bind the PR with the ccd_pr tools (`get_status`, then `bind_pr` if needed), and finish with the PR link (for a feature-branch task, say it merges into that branch, not main), its preview (`https://mars.bryon.site/preview/<N>/`, live a few minutes after the push), anything Bryon should look at when reviewing, and that `/land <id>` merges it and cleans up once he's happy.

If Bryon closes the PR without merging, the ticket goes back to ready on its own (its issue is still open), but the remote branch must go too, or it will keep showing as in flight: `/land <id>` with his OK to drop it.

## Building a feature (`/build #109`)

The output is a plan Bryon can agree, not code. Same steps, with these changes:

- **Pick**: `node scripts/board.mjs show #109`. Session title `#109: <title>`. Answer its open questions first, as for a ticket. If it's already agreed, it's a revision: say so.
- **Overlap**: check open PRs for other plans or code in the same system.
- **Branch** `<N>-<slug>` from `origin/main` in a worktree; claim it the same way (push, then `log #109 "planning on <branch>"`). The board then shows "plan in flight".
- **Plan**: read the code and docs the feature touches, then fill in its Design and **Breakdown** on the issue: tasks in build order, each one `- [ ]` line, each small enough for one PR (S–L, never XL), that leave the game working when merged one at a time. Big designs go in the next free `docs/PLAN-M*.md` (linked from a `**Plan:** \`docs/PLAN-M*.md\`` line at the top of the feature's body), shaped like the other milestone plans; the feature keeps the Goal, a short Design summary and the Breakdown. Put anything only Bryon can decide under Open questions.
- **No code, no tests.** If there's a plan doc, commit it as `docs(<scope>): plan <title> (#109)` and open a PR titled the same (no `Closes`: the feature stays open). If the plan fits in the issue, there's no PR: say so and remove the branch (`/land` with his OK). Give Bryon the Breakdown in your final message so he can agree it or ask for changes.
- Don't set the feature to agreed or make its tasks: that's Bryon's call, made in /board ("agree #109") once the plan is in. That's also where he can put it on a feature branch of its own.
