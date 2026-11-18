---
name: land
description: Close the loop on a Downtown Mars ticket or branch after review — merge its PR if CI is green (or turn on auto-merge while CI runs), stop its dev servers and /try tabs, delete its branches, update main and show what's ready next. With nothing named, sweep up everything already merged. Use when Bryon types /land, or says a PR is good to merge, or asks to clean up branches, worktrees or stray dev servers.
---

# /land [#N … | #PR | branch]

Tickets go by issue number (`#212` or `212`, landing its `212-…` branch; `#N` is a PR when N is one). Old ids still work (`t17`, `f1` find their issue's branch, or an older `t-017-…` one). Pass them to the script as typed and say `#N` back. `scripts/land.mjs` does the work; never run the git, gh or kill commands by hand.

## Who tidies what

The desktop app and GitHub now do part of the cleanup themselves, and the script leaves that to them:

- **The app** archives a session once its PR merges or closes (Settings: auto-archive on PR close, on), stopping it and tidying its worktree. It also **reuses** its worktree folders (`.claude/worktrees/<slug>-<6 hex>`) for later sessions, so the script never removes those: it stops their servers and detaches them from the landed branch, and the folder stays. Old worktrees from the CLI or `/try --checkout` are removed as before. For app worktrees that pile up on disk, the app's own cleanup (`mcp__ccd_host__clean_up_worktrees`, Settings › Storage) is the tool; offer it, don't run it unasked.
- **GitHub** deletes a PR's branch when it merges (the repo's "delete branch on merge"), and its "CI must pass" ruleset on main means auto-merge waits for green CI.
- **The script** merges (or arms auto-merge), closes a feature task's issues (GitHub only closes them on merges into main), stops dev servers, deletes the local branches that pile up (`212-…`, the app's `claude/…`, the CLI's `worktree-…`), and fast-forwards main.

It never stops or touches a live Claude session's worktree: a running `claude` process inside it counts, as does a git lock. So `/land` from the session that built the PR is fine: the merge happens, and that worktree is skipped until the app archives the session.

## 1. Look before leaping

```sh
node scripts/land.mjs <targets> --dry-run --json
```

It prints `{ landed, skipped, open, notes }`:

- **landed**: what would happen to each branch (merged, issues closed, servers stopped by port, worktree removed, branches deleted).
- **open**: PRs still open, with `ci` (passing, failing, pending, none) and `mergeState`.
- **skipped**: why something was left alone: a live session in the worktree, uncommitted changes, a PR closed without merging, a branch with no PR that isn't in main (in flight).

If it stops with "Can't reach GitHub", nothing was changed: say so, and try again in a moment rather than guessing.

## 2. Do it

- **A named ticket, PR or branch whose PR is open**: Bryon naming it is the go-ahead to merge. Rerun with `--merge` (without `--dry-run`):
  - CI passing and `clean`: the script squash-merges it now. A PR into main closes its issue itself (`Closes #N`).
  - CI still running (`pending`, which main's ruleset shows as `blocked`): it turns on GitHub's **auto-merge**, and GitHub merges it once CI passes. The output's `open` row says `autoMerge: true`. Tell Bryon it'll merge by itself; a later `/land` (or the next sweep) deletes its local branch.
  - CI failing, conflicting (`dirty`) or a draft: say so and stop. If this session's PR is bound with Auto-fix on, the app is already on failing CI; otherwise offer to look at it.
- **A task of a feature on its own branch** (`node scripts/board.mjs base <id>` isn't `main`): the same, but it merges into that feature branch, not main; say so. GitHub doesn't close issues on merges into other branches, so the script closes the task's issue itself (`closed` in its output), now or, after an auto-merge, on the next sweep. If no PR takes the feature branch into main yet, open one as a draft so Bryon has a playable preview of the whole feature so far: `gh pr create --draft --base main --head feature/f-0NN-<slug> --title "<type>(<scope>): <feature title> (F-0NN)"`, body: one line on the feature, `Feature: #<the feature's issue number>`, and the PR attribution line. Give him its preview link (`https://mars.bryon.site/preview/<N>/`).
- **The feature branch itself** (`/land feature/<branch>` or its PR number; the feature's issue number alone lands only its plan branch): only when Bryon names it, after he's tested it. Mark the PR ready (`gh pr ready <N>`) if it's a draft, then `--merge` as above; the script merges it with a merge commit, keeping each task's commit. Afterwards `node scripts/board.mjs log F-0NN "merged into main" --status done`.
- **A branch from before the move to issues** that still edits `docs/tickets/` (now gone from main): the script merges main into it keeping the deletion, pushes that and skips the merge ("dropped its docs/tickets/ changes … /land again once CI passes"). Say so; landing it again once CI is green finishes the job.
- **Already merged, or the sweep (nothing named)**: rerun without `--dry-run`. It's all already in main, so no need to ask. In a sweep, list the open PRs but don't merge them; offer to.
- **Skipped**: never add `--force` by yourself. Show the reason, and ask only where it's his call: uncommitted changes in a merged worktree ("discard them?"), or a PR closed without merging ("drop the branch?"). A live session in the worktree is fine to leave: the app archives it when its PR closes, and the next sweep finishes the job. If it's an old session he's done with, link it (`[title](#local_…)`, from `mcp__ccd_session_mgmt__list_sessions`) and offer to archive it; archive only on his yes.

Then stop the Terminal-panel tabs /try opened for the landed branches: `list_terminal_tabs` (load with ToolSearch `select:mcp__terminal__list_terminal_tabs,mcp__terminal__stop_terminal_tab`), and for each tab titled `try <branch or ticket>` or started in a landed worktree, `stop_terminal_tab` with `close: true`. It only acts on tabs this session opened; the script has already stopped the servers themselves, so anything else is just an idle shell.

## 3. Tell Bryon

One short message: what landed (PR numbers, merged now or auto-merging, ports stopped, branches deleted), anything skipped and why, then what's next:

```sh
node scripts/board.mjs menu
```

Show only its Ready list (first few lines) and suggest the next quick win, or `/batch` if several small ones are ready. If the script's notes say main didn't fast-forward (uncommitted changes, diverged), pass that on.
