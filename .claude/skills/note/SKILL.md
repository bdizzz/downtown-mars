---
name: note
description: Drop a playtest note or observation about Downtown Mars into the local notes inbox, verbatim, for /ingest to process later. Use when Bryon types /note, or in a session he's set aside for taking notes.
---

# /note

Add Bryon's note to the inbox and do nothing else: no investigating, no code, no doc edits, no opinions unless asked.

1. Take the text after `/note` exactly as written (typos and all; /ingest interprets it later). If it spans several lines, keep them.
2. Run it through stdin so quotes and newlines survive:
   ```sh
   node scripts/board.mjs note <<'NOTE'
   <the note>
   NOTE
   ```
   It appends the text verbatim to `.tracker/inbox.md` in the main checkout (gitignored, this machine only) under a heading with its id (`L-12`) and the time. Nothing goes to GitHub.
3. If Bryon attached a screenshot, save it to the tracker's `images/` folder (`node scripts/board.mjs path` prints the tracker folder) as `<YYYY-MM-DD-HHMM>.png`, and add `[screenshot: images/<name>.png]` to the note before sending it. /ingest will say which ticket it belongs to, so Bryon can drag it onto that issue on github.com.
4. Reply with one short line, e.g. "Noted as L-12 (3 waiting)."

Notes can also come straight from GitHub (the phone app, the web, the "Note" issue template), for when Bryon is away from this machine: any open issue that isn't a task or feature counts as one. Nothing to do here for those.

If this session is a note-taking session (Bryon said so, or it has only been /notes so far), treat any plain message that reads like an observation about the game as a note too, without needing `/note`. Ask only if it's genuinely unclear whether a message is a note or a question to you.
