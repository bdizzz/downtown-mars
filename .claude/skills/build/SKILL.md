---
name: build
description: Implement one item from the Downtown Mars playtest board end to end — check open PRs for overlap, branch from a fresh main in a worktree, build, test, update docs, push and open a PR. Use when Bryon types /build, with a card id (T-012), a description, or nothing to pick from the menu.
---

# /build [T-0NN … | description]

One item, one branch, one PR (several ids only if Bryon lists them together; they share a branch and PR). The board lives outside git; `node scripts/board.mjs` works from any worktree.

## 1. Pick the item

Run `node scripts/board.mjs menu` (it also syncs merged PRs).

- **An id**: use it. **A description**: find the matching card in the menu and confirm it in one line before starting.
- **Nothing**: show the menu's Ready list and ask which. Understand "quick win" (the oldest Ready S), "oldest" and "answer questions" (as in /board).
- If the menu says notes are waiting in the inbox, mention it once: "4 notes not on the board yet; /ingest first?" Don't ingest unless he says so.

Then `node scripts/board.mjs show T-0NN` and read the card.

- **noted** (open questions): ask them, update the card with the answers, `move T-0NN ready --why "questions answered"`, and continue.
- **in-flight**: another session may be on it; ask before taking it over.
- **blocked / in-review / done**: say so and stop, unless Bryon says otherwise.

## 2. Check open PRs for overlap

```sh
gh pr list --state open --json number,title,headRefName,files --jq '.[] | {number, title, headRefName, files: [.files[].path]}'
```

Compare each open PR with the card's `area`, `touches` and Approach. It's a quick conceptual check, not a code review: the same files, the same data file, or the same system (both rework room layouts; both change how dust spreads) counts as overlap. Unrelated areas that both touch a big shared file like `src/sim/state.ts` in different places don't count.

If there's overlap, tell Bryon in one or two lines ("PR #41 (T-007) rewrites `data/layouts.json`; T-012 changes room layouts too, so they'll probably conflict") and ask: merge that first, go ahead anyway, or pick something else? If he defers it: `node scripts/board.mjs move T-0NN blocked --blocked-by T-007 --why "overlaps PR #41"` (use `--blocked-by 41` when the PR isn't from a card), then go back to step 1.

## 3. Branch from a fresh main

The branch is `t-0NN-<card-slug>`, e.g. `t-012-drill-button-hidden`.

- If this session is in the main checkout (`git rev-parse --git-dir` equals `--git-common-dir`), don't build there; it's where Bryon takes notes and plays. Load `EnterWorktree` (ToolSearch `select:EnterWorktree`) and enter a worktree named after the branch.
- In the worktree: `git fetch origin main` and `git switch -c t-0NN-<slug> origin/main`. If that fails because the worktree's branch already has commits of its own, stop and ask. (In an app-made worktree, use the `sync_with_base_branch` tool to bring in main later, not `git merge`.)
- Install packages if `node_modules` is missing (`npm install`).
- `node scripts/board.mjs move T-0NN in-flight --branch t-0NN-<slug>`

## 4. Build it

Work as CLAUDE.md says: brain and face, data in JSON, deterministic sim. Read only the docs the card points at, plus `docs/DECISIONS.md` if the change touches design. If the work turns out much bigger than the card's size, or raises a design question the docs don't answer, stop and ask rather than growing the PR. Bryon can split the card.

## 5. Check it

- `npm test` (unit tests and the scripted playthroughs). For `src/bridge` changes also `npx tsc --noEmit -p tsconfig.node.json`; for Godot, `cd godot && dotnet build` and a test run as in "Testing the viewer" in `docs/PLAN-GODOT.md`.
- Browser check for anything visible: start the dev server with preview_start and use **http://[::1]:5173**, never `localhost:5173`, so Bryon's own saves aren't touched. Take a screenshot of the change for the PR.
- If something can't be checked (a long-game balance effect, say), say so in the PR rather than skipping it silently.

## 6. Docs, commit, PR

- Update the docs the card lists under "Docs to update", plus whatever the change makes stale: "Notes as built" in the relevant plan, `docs/GUIDE.md` for player-visible changes, `docs/DECISIONS.md` for design decisions, and `node scripts/room-status.mjs` if rooms changed. The README only if its short overview changes.
- Commit in small logical steps, ending each message with the attribution line from the system reminder.
- `git push -u origin t-0NN-<slug>`, then open the PR. Bryon is the only reviewer, so keep it short:

  ```sh
  gh pr create --base main --title "T-0NN: <card title>" --body "$(cat <<'EOF'
  <one to three lines: what changed and why>

  Tested: <npm test, what was checked in the browser>
  Card: T-0NN

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
- `node scripts/board.mjs move T-0NN in-review --pr <number>`
- Bind the PR with the ccd_pr tools (`get_status`, then `bind_pr` if needed), and finish with the PR link and anything Bryon should look at when reviewing.

When the PR merges, the next `/board` or `/build` moves the card to done on its own.
