---
name: try
description: Start the web game's dev server, the Godot viewer, or both, for a ticket's or branch's worktree in Bryon's Terminal panel, on their own ports, so he can try a change. Use when Bryon types /try, or asks to run, test or try a ticket, PR or branch in web or Godot.
---

# /try [T-0NN | branch | main] [web | godot | both]

Ticket ids can be shorthand: `t6`, `T6` and `6` all mean T-006. Pass them to the script as typed; say the full id back to Bryon. The engine is `web` if he names none.

Bryon plays his own web game on port 5173 and his own Godot game with its bridge on 17878, saving to `~/.downtown-mars/saves`. Never touch either: every other checkout's web server gets a port from 5174 up (a different origin, so separate saves), and its Godot viewer a bridge port from 7980 up and a scratch saves folder of its own.

## 1. Work out the commands

Run the script; never write the commands by hand:

```sh
node scripts/try.mjs <target> <engine> --json
```

- **Target**: what Bryon named. If he named nothing, use what this session has been working on (the ticket just built, the PR just discussed) rather than guessing from the worktree list; pass no target only if nothing in the conversation says.
- It prints `{ dir, branch, web?, godot? }`: `web` is `{ port, url, command, running }`, `godot` is `{ port, saves, command, stop, running }`. If it fails, show its message and stop. If it says to rerun with `--checkout` (the branch is on GitHub but has no worktree here, e.g. built on another machine), ask once, then rerun with it.
- `running: true`: that one is already up from this checkout (a dev server, or a viewer's bridge). Skip starting it; give Bryon the URL, or for Godot say it's open and how to stop it (`stop`).

## 2. Run them in the Terminal panel

Run each `command` exactly as printed with `run_in_terminal` (load it with ToolSearch `select:mcp__terminal__run_in_terminal,mcp__terminal__read_terminal` if needed), each in its own tab titled after the branch and engine, e.g. `try t-003 web`, `try t-003 godot`. Not Bash: they should keep running where Bryon can see and stop them.

- **Web**: `read_terminal` with that tab and `wait_for_output_ms` (about 15000, longer if the command starts with `npm install`) until Vite prints its `Local:` line. With `both`, start the web tab first and wait for that line: it installs packages if they're missing, which the Godot viewer's bridge needs too.
- **Godot**: the command builds the C# (`dotnet build`), imports the project the first time in a new checkout (a minute or two), then opens the viewer, which starts its own bridge on its port with `DM_SAVES` set to the scratch folder (its log, `bridge.log`, sits beside it). Read the tab after about 20 s (longer on a first import) for build errors. When the viewer closes, the command's tail stops its bridge.

If either fails (port taken, install or build error), show the error and stop.

## 3. Tell Bryon

One short message:

- **Web**: the URL, and that the menu's bottom left should read `git: <branch>`. Ctrl-C in its tab stops it.
- **Godot**: that the viewer window is opening on a fresh game (or that checkout's last test game: saves are kept per branch, in `saves`). Closing the window stops its bridge too; if it's left running, `stop` does it.
- **What to look at**: if it's a ticket, read it (`node scripts/board.mjs show T-0NN`) and turn its "Done:" line and what was built into a few concrete steps to see the change. For a branch without a ticket, the PR description or the commits (`git log origin/main..<branch> --oneline`).

Don't open the URL in the Browser pane unless he asks; he'll use his own.
