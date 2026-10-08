---
id: T-072
title: A setting to show or hide the system bar in the installed Android app
status: open
size: S
area: ui
touches: [public/manifest.webmanifest, src/ui/settings.ts, src/ui/SettingsView.tsx, src/ui/main.tsx]
blocked_by: [T-088]
notes: [N-0034]
created: 2026-10-06 09:45
---
## Problem
"For installed Android PWAs, we should have an option to show/hide the system bar."

## Context
T-063 (#29) made the game installable with `display: fullscreen` (`display_override: ["fullscreen", "standalone"]` in `public/manifest.webmanifest`), so on Android the status and navigation bars are hidden with no way back. A manifest's display mode can't change at runtime, but the Fullscreen API can: an app launched `standalone` can enter full screen with `document.documentElement.requestFullscreen()` (it needs a user gesture, so it applies on the first tap after launch) and leave it with `document.exitFullscreen()`.

## Approach
Answered (Bryon, Oct 7): hidden by default.

Launch `standalone` and let a setting, **Full screen (hide the system bar)**, on by default, request full screen on the first tap and whenever it's toggled on; off exits it. Show the setting only when installed on Android (`matchMedia("(display-mode: standalone)")` or `fullscreen`, and not iOS, where neither is possible). Done: on an installed Android app, the toggle shows and hides the system bar and the choice sticks across launches.

## Docs to update
GUIDE.md: Settings, and the phone section T-063 added.

## Open questions
- [x] Default: hidden (as now, proposed) or shown?

## History
- 2026-10-06 09:45 opened from N-0034
- 2026-10-07 18:43 questions answered
- 2026-10-07 18:58 waits on T-088 (settings layout)
- 2026-10-08 02:07 building on t-072-android-system-bar-toggle
