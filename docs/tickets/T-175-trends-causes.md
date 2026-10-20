---
id: T-175
title: Trends show health's drain by cause, and happiness by factor, over time
status: done
size: M
area: sim, ui
feature: F-018
touches: [src/sim/history.ts, src/ui/trends.ts, src/ui/TrendChart.tsx, src/ui/TrendsPanel.tsx]
blocked_by: [T-171]
notes: [N-0095]
created: 2026-10-19 21:57
---
## Problem
The player can see health fell, not when a cause started or what changed.

## Context
Read F-018. History samples in `src/sim/history.ts`; series in `src/ui/trends.ts`. Old saves have no cause history: show nothing for that stretch.

## Approach
Record the diagnosis causes in history. Under the Health chart, a stacked band of drain by cause; under Happiness, contribution by factor (noise, comfort, wellbeing, afterglow, events). Hover names the cause at that time. Done: a meals shortage shows as a band starting when the galley closed.

## History
- 2026-10-19 21:57 opened from F-018
- 2026-10-20 03:04 built on ccr-ae9918df-rbn2zw (with T-173–T-175)
