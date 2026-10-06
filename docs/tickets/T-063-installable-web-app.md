---
id: T-063
title: Install the web game on a phone's home screen, without the browser bar
status: open
size: M
area: ui
touches: [index.html, public/manifest.webmanifest, public/icons/, vite.config.ts, scripts/]
blocked_by: []
notes: [N-0030]
created: 2026-10-06 01:58
---
## Problem
Bryon wants to "install" the web page on a phone so play isn't framed by the browser bar, without going as far as an app-store app. That's a Progressive Web App: a manifest, icons and a few tags.

## Context
T-025 (#26, merged) already added the iOS and Android meta tags in `index.html` (`apple-mobile-web-app-capable`, `mobile-web-app-capable`, black-translucent status bar, `viewport-fit=cover`, theme colour). What's missing: a **web app manifest** (name, short name, `display: fullscreen` or `standalone`, background and theme colour, icons), a `<link rel="manifest">`, an **apple-touch-icon** (iOS ignores the manifest's icons), and icons at 192 and 512 px plus a maskable one. Vite builds with `base: "./"`, and the game is served from GitHub Pages under `/downtown-mars/` and PR previews under `/downtown-mars/pr-preview/pr-N/`, so `start_url` and `scope` should be relative (`./`) so each install opens the build it was installed from. Previews use their own storage prefix already (`src/ui/storageKey.ts`).

## Approach
Add `public/manifest.webmanifest` and icons (drawn by a small script into `public/icons/`, or one SVG exported to PNGs; a cozy mark: the borehole seen from above), link them from `index.html`. Chrome on Android shows "Install app" from the manifest alone; iOS Safari uses Share → Add to Home Screen. Answered (Bryon, Oct 6): `display: fullscreen` (iOS falls back to standalone), no service worker or offline play for now, no orientation lock. Done: on Android and iPhone, adding it to the home screen opens the game full screen with its own icon and name, and saves carry on as in the browser for that origin (on iOS a home-screen app has its own storage, separate from Safari's; note that in the guide).

## Docs to update
GUIDE.md and README: playing on a phone, how to add it to the home screen.

## Open questions
- [x] Full screen (no status bar either) or standalone (phone's status bar stays)? Proposed: fullscreen on Android, which falls back to standalone on iOS.
- [x] Offline play with a service worker (cache the build so it opens without a connection)? Proposed: not now; it adds update headaches. A follow-up if wanted.
- [x] Lock to landscape when installed? Proposed: no lock; T-025's layouts handle both.

## History
- 2026-10-06 01:58 opened from N-0030
- 2026-10-06 02:01 questions answered
