---
name: land
description: Close the loop on a Downtown Mars ticket or branch after review — merge its PR if CI is green, stop its dev servers, remove its worktree, delete its branches, update main and show what's ready next. With nothing named, sweep up everything already merged. Use when Bryon types /land, or says a PR is good to merge, or asks to clean up worktrees, branches or stray dev servers.
---

# /land [T-0NN … | #PR | branch]

Ticket ids can be shorthand (`t17`, `17`, `f1`); pass them to the script as typed and say the full id back. `scripts/land.mjs` does the work; never run the git, gh or kill commands by hand.

## 1. Get out of the way

If this session is inside a worktree that's about to go (it's the one you just built in, say), call `ExitWorktree` with `action: "keep"` first; the script refuses to remove the worktree it's run from.

## 2. Look before leaping

```sh
node scripts/land.mjs <targets> --dry-run --json
```

It prints `{ landed, skipped, open, notes }`:

- **landed**: what would happen to each branch (merged, servers stopped by port, worktree removed, branches deleted).
- **open**: PRs still open, with `ci` (passing, failing, pending, none) and `mergeState`.
- **skipped**: why something was left alone: a live session still in the worktree, uncommitted changes, a PR closed without merging, a branch with no PR that isn't in main (in flight).

## 3. Do it

- **A named ticket, PR or branch whose PR is open**: Bryon naming it is the go-ahead to merge. If its CI is passing and it's `clean`, rerun with `--merge` (and without `--dry-run`); the script squash-merges it, the same way the history has gone so far. If CI is failing or pending, or it's conflicting or a draft, say so and stop; don't wait on CI.
- **A task of a feature on its own branch** (`node scripts/board.mjs base T-0NN` isn't `main`): the same, but it merges into that feature branch, not main; say so. If no PR takes the feature branch into main yet, open one as a draft so Bryon has a playable preview of the whole feature so far: `gh pr create --draft --base main --head feature/f-0NN-<slug> --title "<type>(<scope>): <feature title> (F-0NN)"`, body: one line on the feature, `Feature: docs/tickets/F-0NN-<slug>.md`, and the PR attribution line. Give him its preview link (`https://bdizzz.github.io/downtown-mars/pr-preview/pr-<N>/`).
- **The feature branch itself** (`/land feature/f-0NN-…` or its PR number; `F-0NN` alone lands only its plan branch): only when Bryon names it, after he's tested it. Mark the PR ready (`gh pr ready <N>`) if it's a draft, then `--merge` as above; the script merges it with a merge commit, keeping each task's commit. Afterwards `node scripts/board.mjs log F-0NN "merged into main" --status done` and publish.
- **Already merged, or the sweep (nothing named)**: rerun without `--dry-run`. It's all already in main, so no need to ask. In a sweep, list the open PRs but don't merge them; offer to.
- **Skipped**: never add `--force` by yourself. Show the reason, and ask only where it's his call: uncommitted changes in a merged worktree ("discard them?"), or a PR closed without merging ("drop the branch?"). A live session in the worktree is for him to close or archive; say which.

Then stop the Terminal-panel tabs /try opened for the landed branches: `list_terminal_tabs` (load with ToolSearch `select:mcp__terminal__list_terminal_tabs,mcp__terminal__stop_terminal_tab`), and for each tab titled `try <branch or ticket>` or started in a removed worktree, `stop_terminal_tab` with `close: true`. It only acts on tabs this session opened; the script has already stopped the servers themselves, so anything else is just an idle shell.

## 4. Tell Bryon

One short message: what landed (PR numbers, ports stopped, worktrees removed), anything skipped and why, then what's next:

```sh
node scripts/board.mjs menu
```

Show only its Ready list (first few lines) and suggest the next quick win. If the script's notes say main didn't fast-forward (uncommitted changes, diverged), pass that on.
