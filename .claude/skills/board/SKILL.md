---
name: board
description: Show the Downtown Mars playtest board (ready, needs answers, blocked, in flight, in review), syncing PR states from GitHub first. Use when Bryon types /board or asks what's on the board, what's ready, or for quick wins.
---

# /board

1. `node scripts/board.mjs menu`. It moves cards whose PRs merged to done (and closed-unmerged ones back to ready), unblocks cards whose blockers are done, rewrites BOARD.md and prints the short view.
2. Show that output as it is (a code block keeps the columns lined up). Mention the BOARD.md path once in case he wants the full view.
3. Point out only what needs him:
   - notes waiting in the inbox ("run /ingest")
   - cards in "Needs answers": offer to go through their questions now
   - in-flight cards marked `stale?`: a build session probably stopped. Offer to move them back to ready (`move T-0NN ready --why "abandoned"`) or look for their branch.

Options Bryon might add:
- **"quick wins"**: only Ready cards of size S.
- **"answer questions"**: for each Needs answers card, show its Problem and open questions, take his answers, update the card, and move it to ready.
- **an id**: `node scripts/board.mjs show T-0NN` and summarize the card.
- **"drop T-0NN"**: `move T-0NN dropped --why "<his reason>"`.

This skill doesn't build anything; for that it's /build.
