---
id: T-140
title: On phones, a resource group's extra rows sit beside its label, not under it
status: done
size: S
area: ui
touches: [src/ui/ResourceBar.tsx, src/ui/styles.css]
blocked_by: []
notes: [N-0071]
created: 2026-10-11 15:52
---
## Problem
"In mobile web view, if the number of resources in a category wraps onto another row, it shouldn't wrap to underneath the resource category label. The label should span the entire height of that resource section, be anchored left, and then the resources will appear in multiple rows to the right of it."

## Context
The resource grid came in T-089 (`src/ui/ResourceBar.tsx`); phone rules are under `@media (max-width: 639px)` in `styles.css`. T-106 (open) will put the resources behind a toggle on phones; this layout still applies inside it.

## Approach
Make each category a two-column grid: the label in a left column spanning all rows, the resources wrapping in the right column. Done: at 375 px wide, a category with many resources wraps into rows to the right of its label.

## History
- 2026-10-11 15:52 opened from N-0071
- 2026-10-11 18:43 building on t-106-mobile-collapsible-top-bar
- 2026-10-11 18:48 built
