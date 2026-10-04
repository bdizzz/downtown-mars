---
name: board
description: Show the Downtown Mars playtest board (ready, needs answers, blocked, in flight, in review) from docs/tickets/ and GitHub. Use when Bryon types /board or asks what's on the board, what's ready, or for quick wins.
---

# /board

1. `node scripts/board.mjs menu`. It reads the tickets in `docs/tickets/` and GitHub (`t-0NN-…` branches and their PRs), prints the short view and rewrites the full `BOARD.md` in the local tracker.
2. Show the output as it is (in a code block so the columns line up). Mention the BOARD.md path once in case he wants the full view.
3. Point out only what needs him:
   - notes waiting in the inbox ("run /ingest")
   - tickets under "Needs answers": offer to go through their questions now
   - in-flight branches that look abandoned (Bryon will know): offer to delete the remote branch so the ticket shows as ready again (ask first; it's his branch)

Things Bryon might ask for:
- **"quick wins"**: only Ready tickets of size S.
- **"answer questions"**: for each Needs answers ticket, show its Problem and open questions, take his answers, then edit the ticket (tick the questions, fold the answers into Problem/Approach), `node scripts/board.mjs log T-0NN "questions answered"`.
- **an id**: `node scripts/board.mjs show T-0NN` and summarize the ticket.
- **"drop T-0NN"**: `node scripts/board.mjs log T-0NN "dropped: <his reason>" --status dropped`.
- **more context for a ticket**: add it to the ticket's Context section.

After any ticket edit, publish: `node scripts/board.mjs publish "chore(tickets): <what changed>"` plus a blank line and the attribution line from the system reminder (commits only `docs/tickets/` on main and pushes it).

This skill doesn't build anything; for that it's /build.
