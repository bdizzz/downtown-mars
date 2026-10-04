---
name: build
description: Implement one ticket from the Downtown Mars playtest board end to end — check open PRs for overlap, branch from a fresh main in a worktree, build, test, update docs, push and open a PR. Or, given a feature (F-001), write or revise its plan as a doc-only PR. Use when Bryon types /build, with a ticket id (T-012, or shorthand like t12), a feature id (F-001, f1), a description, or nothing to pick from the menu.
---

# /build [T-0NN … | F-0NN | description]

One ticket, one branch, one PR (several ids only if Bryon lists them together; they share a branch and PR named after the first). Tickets are files in `docs/tickets/`. Their live state comes from GitHub: a pushed `t-0NN-…` branch means in flight, an open PR means in review, a merged PR means done. So the branch name matters.

A **feature** id (`F-0NN`) builds its plan instead of code; see "Building a feature" at the end. A ticket with `feature: F-0NN` is one of that feature's tasks: read the feature (`node scripts/board.mjs show F-0NN`, and its `plan:` doc if it has one) before the ticket, and treat its Design as settled.

## 1. Pick the ticket

Run `node scripts/board.mjs menu`.

- **An id**: use it. Shorthand is fine: `t6`, `T6`, `t-6` and `6` mean T-006, `f1` means F-001. `board.mjs` takes either; use the full id (T-006, `t-006-…`) in the session title, branch, commits and PR. **A description**: find the matching ticket in the menu and confirm it in one line before starting.
- **Nothing**: show the menu's Ready list and ask which. Understand "quick win" (the first Ready S; the menu lists small and old first), "oldest" and "answer questions" (as in /board).
- If the menu says notes are waiting in the inbox, mention it once ("4 notes not on the board yet; /ingest first?"). Don't ingest unless he says so.

Then `node scripts/board.mjs show T-0NN` and read the ticket, including its Context.

Name the session after it: load `mcp__ccd_session_mgmt__set_session_title` (ToolSearch `select:mcp__ccd_session_mgmt__set_session_title`) and set the title to `T-0NN: <ticket title>` (for several tickets, `T-014 + T-009: <first title>`). Outside the desktop app the tool doesn't exist; skip it silently.

- **Needs answers**: ask the open questions, fold in the answers (as /board does), publish, and continue.
- **In flight / in review**: another session or machine has it; say which branch or PR and ask before going on.
- **Blocked / done / dropped**: say so and stop unless Bryon says otherwise. A task blocked on its feature (`F-001 (draft)`) waits for Bryon to agree the feature: offer `/build F-001` or agreeing it in /board.

## 2. Check open PRs for overlap

```sh
gh pr list --state open --json number,title,headRefName,files --jq '.[] | {number, title, headRefName, files: [.files[].path]}'
```

Compare each open PR with the ticket's `area`, `touches` and Approach. It's a quick conceptual check, not a code review: the same files, the same data file, or the same system (both rework room layouts; both change how dust spreads) counts as overlap. Unrelated areas that both touch a big shared file like `src/sim/state.ts` in different places don't count.

If there's overlap, tell Bryon in one or two lines ("PR #41 (T-007) rewrites `data/layouts.json`; T-012 changes room layouts too, so they'll probably conflict") and ask: merge that first, go ahead anyway, or pick something else? If he defers it, record the block on main so every machine sees it:

```sh
node scripts/board.mjs log T-0NN "blocked: overlaps PR #41" --blocked-by T-007   # or --blocked-by "#41" if the PR has no ticket
node scripts/board.mjs publish "chore(tickets): block T-0NN on T-007"   # plus a blank line and the attribution line
```

The ticket shows as ready again by itself once T-007 is done. Then go back to step 1.

## 3. Branch from a fresh main

The branch is `t-0NN-<ticket-slug>`, e.g. `t-012-drill-button-hidden`.

- If this session is in the main checkout (`git rev-parse --git-dir` equals `--git-common-dir`), don't build there; it's where Bryon takes notes and plays. Load `EnterWorktree` (ToolSearch `select:EnterWorktree`) and enter a worktree named after the branch.
- In the worktree: `git fetch origin main` and `git switch -c t-0NN-<slug> origin/main`. If that fails because the worktree's branch already has commits of its own, stop and ask. (In an app-made worktree, use the `sync_with_base_branch` tool to bring in main later, not `git merge`.)
- **Claim it**: `node scripts/board.mjs log T-0NN "building on t-0NN-<slug>" --here`, commit that (`chore(tickets): claim T-0NN`), then `git push -u origin t-0NN-<slug>`. The pushed branch is what shows the ticket as in flight on every machine.
- Install packages if `node_modules` is missing (`npm install`).

## 4. Build it

Work as CLAUDE.md says: brain and face, data in JSON, deterministic sim. Read only the docs the ticket points at, plus `docs/DECISIONS.md` if the change touches design. If you learn something worth keeping (a cause, a gotcha), add it to the ticket's Context in the branch (`--here` copy); if it matters to the feature's other tasks, add it to the feature's Design instead. If the work turns out much bigger than the ticket's size, or raises a design question the docs don't answer, stop and ask rather than growing the PR. Bryon can split the ticket.

## 5. Check it

- `npm test` (unit tests and the scripted playthroughs). For `src/bridge` changes also `npx tsc --noEmit -p tsconfig.node.json`; for Godot, `cd godot && dotnet build` and a test run as in "Testing the viewer" in `docs/PLAN-GODOT.md`.
- Browser check for anything visible: start the dev server with preview_start and use **http://[::1]:5173**, never `localhost:5173`, so Bryon's own saves aren't touched. Take a screenshot of the change for the PR.
- If something can't be checked (a long-game balance effect, say), say so in the PR rather than skipping it silently.

## 6. Docs, commit, PR

- Update the docs the ticket lists under "Docs to update", plus whatever the change makes stale: "Notes as built" in the relevant plan, `docs/GUIDE.md` for player-visible changes, `docs/DECISIONS.md` for design decisions, and `node scripts/room-status.mjs` if rooms changed. The README only if its short overview changes.
- Mark the ticket done in the branch, so it lands on main with the merge: `node scripts/board.mjs log T-0NN "built" --status done --here`.
- Commit in small logical steps, in the Conventional Commits format from CLAUDE.md ("Commit messages"), e.g. `fix(ui): keep the drill button clear of the room panel (T-0NN)`, ending each message with the attribution line from the system reminder. `git push`.
- Open the PR. Bryon is the only reviewer, so keep it short:

  ```sh
  gh pr create --base main --title "<type>(<scope>): <summary> (T-0NN)" --body "$(cat <<'EOF'
  <one to three lines: what changed and why>

  Tested: <npm test, what was checked in the browser>
  Ticket: docs/tickets/T-0NN-<slug>.md

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
- Bind the PR with the ccd_pr tools (`get_status`, then `bind_pr` if needed), and finish with the PR link and anything Bryon should look at when reviewing.

If Bryon closes the PR without merging, the ticket goes back to ready on its own (it's still `open` on main), but delete the remote branch too, or it will keep showing as in flight.

## Building a feature (`/build F-0NN`)

The output is a plan Bryon can agree, not code. Same steps, with these changes:

- **Pick**: `node scripts/board.mjs show F-0NN`. Session title `F-0NN: <title>`. Answer its open questions first, as for a ticket. If it's already agreed, it's a revision: say so.
- **Overlap**: check open PRs for other plans or code in the same system.
- **Branch** `f-0NN-<slug>` from `origin/main` in a worktree; claim it the same way (`log F-0NN "planning on f-0NN-<slug>" --here`, commit `chore(tickets): claim F-0NN`, push). The board then shows "plan in flight".
- **Plan**: read the code and docs the feature touches, then fill in its Design and **Breakdown**: tasks in build order, each one line, each small enough for one PR (S–L, never XL), that leave the game working when merged one at a time. Big designs go in the next free `docs/PLAN-M*.md` (linked from the feature's `plan:`), shaped like the other milestone plans; the feature keeps the Goal, a short Design summary and the Breakdown. Put anything only Bryon can decide under Open questions.
- **No code, no tests.** Commit as `docs(<scope>): plan F-0NN <title>`, open a PR titled the same, and give Bryon the Breakdown in your final message so he can agree it or ask for changes.
- Don't set the feature to agreed or write its task tickets: that's Bryon's call, made in /board ("agree F-0NN") once the plan PR is merged.
