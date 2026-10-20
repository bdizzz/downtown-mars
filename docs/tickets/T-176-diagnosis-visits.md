---
id: T-176
title: The doctor and a residents' delegate visit the office about a lasting problem, then ask for a fix
status: done
size: M
area: sim, events
feature: F-018
touches: [data/visits.json, src/sim/visits.ts, src/ui/Office.tsx]
blocked_by: [T-171]
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
Office visits that are "either information only or per a challenge to take an action in a time frame" (Bryon).

## Context
Read F-018. Visits and promises: `data/visits.json` (`noise_complaint` is the model), triggers in `src/sim/visits.ts`.

## Approach
When a diagnosis cause has held for a while (health: the doctor; happiness: a residents' delegate), a visit names it and the fix. The first time for each cause it's information only ("Noted", with Show me). Later ones offer "I'll fix it within 3 months" (kept: loyalty and +happiness; broken: −loyalty) or refuse. Done: a hole short of meals gets the doctor's information visit, then later the challenge; a test checks the promise is kept when meals recover.

## Docs to update
EVENTS.md: citizen visits; GUIDE.md: The office.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-20 12:39 building on ccr-ffc77851-fv2xl2 (with T-176, T-177, T-178)
- 2026-10-20 12:59 built
