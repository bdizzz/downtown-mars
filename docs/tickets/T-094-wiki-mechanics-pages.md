---
id: T-094
title: Write the mechanics pages, and generate GUIDE.md from the guide
status: open
size: M
area: docs, ui
touches: [docs/wiki/, docs/GUIDE.md, scripts/guide.mjs, README.md]
blocked_by: [T-092]
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010's hand-written pages: the mechanics, from `GUIDE.md`'s sections, split into linked pages.

## Context
See F-010's Design. `docs/GUIDE.md` (275 lines) covers building, digging, getting in and out, homes, meals and reach, water, materials and storage, air and smell, people, condition, Earth and events, more holes, the views, controls, saving and settings. Bryon (Oct 8): generate `GUIDE.md` from the wiki so there's one source.

## Approach
One page per mechanic, linking to the generated room and resource pages; a script (`scripts/guide.mjs`) that stitches the pages back into `docs/GUIDE.md`, with a note at its top that it's generated; CI or a test checks it's current. Done: the guide's text lives in `docs/wiki/`, `GUIDE.md` is generated and reads as before.

## Docs to update
CLAUDE.md and README: GUIDE.md is generated; edit `docs/wiki/`.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
