---
name: deps
description: Draw the Downtown Mars ticket dependency tree as a diagram in the Claude UI, with tickets as boxes coloured by state (ready purple, blocked gray, in flight or review blue, done green) and arrows for blocked_by. Use when Bryon types /deps, or asks for the dependency tree, chart or graph of the tickets.
---

# /deps [days]

`days` (optional, default 7): how long a ticket stays on the chart after it ships. `0` hides everything done. Accept "14", "14d" or "14 days"; pass the number.

1. `node scripts/board.mjs graph --days=<days>`. It prints a finished SVG: every open ticket as a box (ready purple, needs answers purple with a dashed border, blocked gray, in flight or in review blue, done green), arrows from each ticket to the ones it unblocks, linked groups laid out top-down by depth, and tickets with no dependencies in a grid underneath. It's sized and classed for the Claude UI's diagrams (680 wide, the `c-*` colour ramps and `t`/`ts`/`th` text, so it follows light and dark mode). Each box's tooltip has the full title and what it waits on.
2. Show it with the visualize tool's `show_widget`, passing the SVG **exactly as printed** (don't redraw, re-lay out or trim it), titled `ticket_dependency_graph`. Load the tool with ToolSearch if it's deferred; call its `read_me` (module `diagram`) first if this conversation hasn't yet, without mentioning it.
3. After the chart, at most two lines: what's worth starting (ready tickets that unblock the most, by counting arrows out of them in the SVG or `blocked_by` in the tickets), and anything in review waiting on him. Don't list the tickets again; the chart shows them.

If the command fails (GitHub unreachable makes it say so but still works), show its message. Features themselves aren't boxes: their tasks carry the feature id (`· F-002`) under the ticket id.
