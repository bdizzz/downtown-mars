---
id: T-014
title: Import save file does nothing after picking a file
status: done
size: S
area: ui
touches: [src/ui/saves.ts]
blocked_by: []
notes: []
created: 2026-10-05 10:00
---
## Problem
Menu → "Import save file…" opens the file dialog, but after picking a save (e.g. `downtown-mars-day-45.json`, save v18) nothing happens: no load, no error.

## Context
- The save itself is fine: it loads through the sim host in Node (`loaded ok`), and in the browser when the picker is faked (setting `files` and dispatching `change`).
- So the real picker's `change` never reaches `pickSaveFile` (`src/ui/saves.ts`). It creates an `<input type="file">` that is never attached to the document and is referenced only from its own `onchange` closure; Chrome and Safari can garbage-collect it while the dialog is open, so `onchange` never fires. The code is unchanged since M2, so a browser update is the likely trigger.
- A cancelled pick also leaves the promise hanging forever (no `cancel` handling).

## Approach
Attach the input to `document.body` (hidden) while the dialog is open, remove it after `change` or `cancel`, and resolve `null` on `cancel`.

## Docs to update
- None (a bug fix; no player-visible change beyond import working again).

## Open questions

## History
- 2026-10-05 10:00 opened from a bug report in chat
- 2026-10-05 00:33 building on t-014-import-save-silent
- 2026-10-05 00:34 built
