---
id: T-096
title: The guide as a website on GitHub Pages
status: open
size: M
area: ui, docs
touches: [scripts/wiki-site.mjs, .github/workflows/pages.yml]
blocked_by: [T-092, T-094]
feature: F-010
notes: [N-0050]
created: 2026-10-08 02:14
---
## Problem
F-010: the same guide readable on the web, outside the game (Bryon, Oct 8: in the game first, the website later from the same pages).

## Context
See F-010's Design. The game deploys to GitHub Pages (`.github/workflows/pages.yml`, `scripts/gh-pages.sh`; only GitHub's own actions are allowed). The pages and links come from T-092.

## Approach
A script renders every page to static HTML (same look as the in-game reader, with search) under `/downtown-mars/guide/`, built and published alongside the game. Locked markings don't apply on the site; everything is shown. Done: the guide is browsable at its own URL and updates with each deploy.

## Docs to update
README: link to the online guide.

## History
- 2026-10-08 02:14 opened from F-010's breakdown
