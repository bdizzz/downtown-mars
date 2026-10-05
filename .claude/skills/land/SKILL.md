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
- **Already merged, or the sweep (nothing named)**: rerun without `--dry-run`. It's all already in main, so no need to ask. In a sweep, list the open PRs but don't merge them; offer to.
- **Skipped**: never add `--force` by yourself. Show the reason, and ask only where it's his call: uncommitted changes in a merged worktree ("discard them?"), or a PR closed without merging ("drop the branch?"). A live session in the worktree is for him to close or archive; say which.

Then stop the Terminal-panel tabs /try opened for the landed branches: `list_terminal_tabs` (load with ToolSearch `select:mcp__terminal__list_terminal_tabs,mcp__terminal__stop_terminal_tab`), and for each tab titled `try <branch or ticket>` or started in a removed worktree, `stop_terminal_tab` with `close: true`. It only acts on tabs this session opened; the script has already stopped the servers themselves, so anything else is just an idle shell.

## 4. Tell Bryon

One short message: what landed (PR numbers, ports stopped, worktrees removed), anything skipped and why, then what's next:

```sh
node scripts/board.mjs menu
```

Show only its Ready list (first few lines) and suggest the next quick win. If the script's notes say main didn't fast-forward (uncommitted changes, diverged), pass that on.
