---
name: try
description: Start the web game's dev server for a ticket's or branch's worktree in Bryon's Terminal panel, on its own port, so he can try a change in the browser. Use when Bryon types /try, or asks to run, test or try a ticket, PR or branch in web mode.
---

# /try [T-0NN | branch | main]

Ticket ids can be shorthand: `t6`, `T6` and `6` all mean T-006. Pass them to the script as typed; say the full id back to Bryon.

Bryon plays his own game on port 5173. Every other checkout gets its own port from 5174 up: a different origin, so its saves are separate too.

## 1. Work out the command

Run the script; never write the command by hand:

```sh
node scripts/try.mjs <target> --json
```

- **Target**: what Bryon named. If he named nothing, use what this session has been working on (the ticket just built, the PR just discussed) rather than guessing from the worktree list; pass no target only if nothing in the conversation says.
- It prints `{ dir, branch, port, url, command, running }`. If it fails, show its message and stop. If it says to rerun with `--checkout` (the branch is on GitHub but has no worktree here, e.g. built on another machine), ask once, then rerun with it.
- `running: true`: a server is already serving that checkout. Skip step 2 and give Bryon the URL.

## 2. Run it in the Terminal panel

Run `command` exactly as printed with `run_in_terminal` (load it with ToolSearch `select:mcp__terminal__run_in_terminal,mcp__terminal__read_terminal` if needed), titled after the branch, e.g. `try t-003`. Not Bash: the server should keep running where Bryon can see and stop it.

Then `read_terminal` with that tab and `wait_for_output_ms` (about 15000, longer if the command starts with `npm install`) until Vite prints its `Local:` line. If it fails instead (port taken, install error), show the error and stop.

## 3. Tell Bryon

One short message:

- The URL, and that the menu's bottom left should read `git: <branch>`.
- **What to look at**: if it's a ticket, read it (`node scripts/board.mjs show T-0NN`) and turn its "Done:" line and what was built into a few concrete steps to see the change. For a branch without a ticket, the PR description or the commits (`git log origin/main..<branch> --oneline`).
- That Ctrl-C in that terminal tab stops it.

Don't open the URL in the Browser pane unless he asks; he'll use his own.
