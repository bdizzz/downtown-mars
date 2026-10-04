---
name: board
description: Show the Downtown Mars playtest board (features, ready, needs answers, blocked, in flight, in review) from docs/tickets/ and GitHub, and agree features into task tickets. Use when Bryon types /board or asks what's on the board, what's ready, or for quick wins.
---

# /board

1. `node scripts/board.mjs menu`. It reads the tickets and features in `docs/tickets/` and GitHub (`t-0NN-…` and `f-0NN-…` branches and their PRs), prints the short view and rewrites the full `BOARD.md` in the local tracker. Features come first, each with its tasks' states on the line below; tasks also appear in the ticket columns, tagged with their feature.
2. Show the output as it is (in a code block so the columns line up). Mention the BOARD.md path once in case he wants the full view.
3. Point out only what needs him:
   - notes waiting in the inbox ("run /ingest")
   - tickets or features under "Needs answers": offer to go through their questions now
   - draft features with a plan ready (their plan PR merged, or the Breakdown filled in): offer to agree them
   - in-flight branches that look abandoned (Bryon will know): offer to delete the remote branch so the item shows as ready again (ask first; it's his branch)

Things Bryon might ask for:
- **"quick wins"**: only Ready tickets of size S.
- **"answer questions"**: for each Needs answers ticket or feature, show its Problem (or Goal) and open questions, take his answers, then edit it (tick the questions, fold the answers into Problem/Approach, or a feature's Design), `node scripts/board.mjs log T-0NN "questions answered"`.
- **an id**: `node scripts/board.mjs show T-0NN` (or `F-0NN`) and summarize it.
- **"drop T-0NN"** / **"drop F-0NN"**: `node scripts/board.mjs log <id> "dropped: <his reason>" --status dropped`. Dropping a feature: ask whether its open tasks go too.
- **more context for a ticket**: add it to the ticket's Context section (or the feature's Design, if it's about the whole feature).
- **"agree F-0NN"**: show the feature's Breakdown and confirm it in one line. Then `node scripts/board.mjs log F-0NN "agreed" --status agreed`, and for each Breakdown line without "→ T-0NN", write a ticket as /ingest does (ids from `node scripts/board.mjs next-id`, `feature: F-0NN`, `notes` from the feature, `blocked_by` for tasks that need an earlier one), lean on the feature for context rather than repeating it, and add "→ T-0NN" to the line. The tasks show as Ready (or Blocked) straight away.
- **"new feature …"** or **"make T-0NN a feature"**: write `F-0NN` as /ingest does (`next-id F`); to fold a ticket in, move its design into the feature, then drop it (`"dropped: folded into F-0NN"`) or keep it as a task (`--feature F-0NN`).

After any ticket or feature edit, publish: `node scripts/board.mjs publish "chore(tickets): <what changed>"` plus a blank line and the attribution line from the system reminder (commits only `docs/tickets/` on main and pushes it).

This skill doesn't build anything; for that it's /build (`/build F-0NN` writes a feature's plan).
