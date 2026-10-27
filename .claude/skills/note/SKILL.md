---
name: note
description: Drop a playtest note or observation about Downtown Mars on the board as a note issue on GitHub, verbatim, for /ingest to process later. Use when Bryon types /note, or in a session he's set aside for taking notes.
---

# /note

Make Bryon's note an issue and do nothing else: no investigating, no code, no doc edits, no opinions unless asked.

1. Take the text after `/note` exactly as written (typos and all; /ingest interprets it later). If it spans several lines, keep them.
2. Run it through stdin so quotes and newlines survive:
   ```sh
   node scripts/board.mjs note <<'NOTE'
   <the note>
   NOTE
   ```
   It opens an issue labeled `note`, titled with the note's first words, the text verbatim as its body.
3. If Bryon attached a screenshot, save it to the tracker's `images/` folder (`node scripts/board.mjs path` prints the tracker folder) as `<YYYY-MM-DD-HHMM>.png`, and tell him the issue can't take it from here: he can drag it onto the issue on github.com if it should travel with the note. Add `[screenshot on <this machine>: images/<name>.png]` to the note before sending it.
4. Reply with one short line, e.g. "Noted as #214 (3 waiting)."

Notes can also come straight from GitHub (the phone app, the web, the "Note" issue template): any open issue that isn't a task or feature counts as one. Nothing to do here for those.

If this session is a note-taking session (Bryon said so, or it has only been /notes so far), treat any plain message that reads like an observation about the game as a note too, without needing `/note`. Ask only if it's genuinely unclear whether a message is a note or a question to you.
