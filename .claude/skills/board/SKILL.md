---
name: board
description: Show the Downtown Mars playtest board (features, ready, needs answers, blocked, in flight, in review) from GitHub Issues, and agree features into task tickets. Use when Bryon types /board or asks what's on the board, what's ready, or for quick wins.
---

# /board

1. `node scripts/board.mjs menu`. It reads the tickets and features (GitHub issues labeled `task` and `feature`) and their branches and PRs, prints the short view and rewrites the full `BOARD.md` in the local tracker. Features come first, each with its tasks' states on the line below; tasks also appear in the ticket columns, tagged with their feature.
2. Show it as **markdown tables**, not a code block, rebuilt from the output (keep every row and its wording; don't summarize):
   - **Features**: Feature · State · Title · Tasks (the line under each feature: its tasks' states, branch or PR). No age column here either.
   - Then one table per group in the output's order (Ready, Needs answers, Blocked, In flight, In review), each under a short bold heading with its count: Ticket · Size · Title · Notes (feature, what it waits on, PR or branch; blank if none). Leave out the age the output prints after each title. Leave out empty groups.
   - The "N done" line and the BOARD.md path as one line after the tables, so he can open the full view.
3. Point out only what needs him:
   - notes waiting ("run /ingest")
   - tickets or features under "Needs answers": offer to go through their questions now
   - draft features with a plan ready (their plan PR merged, or the Breakdown filled in): offer to agree them
   - features **ready to merge** (on their own branch, every task finished): offer `/try feature/<branch> --checkout` to test the whole thing, then `/land feature/<branch>` to merge it into main
   - in-flight branches that look abandoned (Bryon will know): offer to delete the remote branch so the item shows as ready again (ask first; it's his branch)

Ids: everything goes by issue number (`#212`, or just `212`). The old ids from before the move to issues (`T-080`, `F-004`) still work as aliases, through `docs/ticket-ids.json`: `t6` is T-006's issue, `f1` is F-001's. `board.mjs` takes them as typed and prints `#N`; say `#N` back. (Closed issues from before the move keep `T-0NN · ` in their titles, as history.)

Editing an item's text is always the same three steps: `node scripts/board.mjs body <id> > <scratch file>`, edit the file, `node scripts/board.mjs set-body <id> <scratch file>`. Every change is live on GitHub at once: there's nothing to commit or publish.

Things Bryon might ask for:
- **"quick wins"**: only Ready tickets of size S.
- **"answer questions"**: for each Needs answers ticket or feature, show its Problem (or Goal) and open questions, take his answers, then edit it (tick the questions, fold the answers into Problem/Approach, or a feature's Design) and `node scripts/board.mjs log <id> "questions answered"`.
- **an id**: `node scripts/board.mjs show <id>` and summarize it.
- **"drop #212"**: `node scripts/board.mjs log <id> "dropped: <his reason>" --status dropped`. Dropping a feature: ask whether its open tasks go too.
- **more context for a ticket**: add it to the ticket's Context section (or the feature's Design, if it's about the whole feature).
- **"agree #109"**: show the feature's Breakdown and confirm it in one line. Then `node scripts/board.mjs log #109 "agreed" --status agreed`, and for each unticked Breakdown line (the nth `- ` line under `## Breakdown`), make its task as /ingest does, with `--feature F-0NN --breakdown <n>` (which makes it a sub-issue and ticks that line with "→ #N"), `--notes` from the feature, and `--blocked-by` for tasks that need an earlier one. Lean on the feature for context rather than repeating it. The tasks show as Ready (or Blocked) straight away. If he wants it **on a feature branch** (to test the whole feature before it reaches main), also run `node scripts/board.mjs feature-branch F-0NN`: tasks then branch from `feature/f-0NN-…` and merge into it.
- **"new feature …"** or **"make #212 a feature"**: make it as /ingest does (`new feature`); to fold a ticket in, move its design into the feature, then drop it (`"dropped: folded into F-0NN"`) or keep it as a task (`--feature F-0NN`).

This skill doesn't build anything; for that it's /build (`/build #109` on a feature writes its plan). For the dependency tree as a diagram, it's /deps.
