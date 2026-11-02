# Milestone 18 plan: the room panel at a glance

Goal: the room panel stops being a wall of text. What matters most is visible at once, in a fixed order; the rest folds into sections and tooltips; and numbers show as icons, colors and meters where a sentence isn't needed. Feature F-019 (F-019 ([#124](https://github.com/bdizzz/downtown-mars/issues/124))).

## Decided (Bryon, Oct 25)

- The header shows the name, a status color, staff and the room's main output; a home shows residents and happiness instead.
- No sparklines: icons, colors and meters only, so the sim keeps no per-room history.
- Web and Godot change together: every step lands in both viewers in one PR.
- Open sections are remembered per section across rooms, not reset for each room.
- Demolish sits at the bottom of the Building section, not behind a menu in the header.

## Where it stands today

The panel is built in three places that share one source:

- `src/view/roomPanel.ts` makes the content: `panelRows(s, room)` returns `{ before, after }`, two lists of `Row { k?, text, warn? }` (a dimmed label and a sentence), plus helpers for the blocks with controls (`constructionInfo`, `conditionNote`, `refitOptions`, `storageInfo`, `seedKitInfo`, `stopAtInfo`).
- `src/ui/Inspector.tsx` draws it on the web, top to bottom: title, the state sentence (`view/roomState.ts`), construction, condition bar, storage, Connect, `before` rows, the seed kit, `after` rows, refit, crop, holds, tank fill, priority, running/stop at, demolish.
- `src/bridge/inspect.ts` sends the same parts to Godot as an `inspected` message, and `godot/src/Inspector.cs` draws them, with each row list as one `RichTextLabel` of BBCode lines.

Every row has the same weight. A home on floor 3 runs to about 16 lines: staff, residents, happiness, comfort, noise, wellbeing (each a long "= a +1, b −0.5 (Smelter −0.4)" sum), walls, windows, crowded, meals, restroom, within reach, on foot, felt here, bothers, lifts. The one thing the player came for (why is it unhappy?) is somewhere in the middle.

## The design

### 1. Four tiers, always in this order

1. **Header**: the name (✎ to rename) and "Farm · floor 3", a **status pill** and up to three **headline chips**.
2. **Alerts**: every warning in the panel, raised here as one short line each, so nothing that's wrong hides in a closed section.
3. **At a glance**: a band of chips and small meters for the room's few numbers that matter besides the headline.
4. **Sections**: everything else, in collapsible sections, most of them closed.

### 2. The header

- **Status pill**: a short word or two in a tone color, with the full `roomState` sentence as its tooltip.

  | Tone | When | Pill says (examples) |
  | --- | --- | --- |
  | good (green) | running at full rate | Running |
  | idle (gray) | paused, standing by, stocked, night, storage full, waiting for a kit | Paused · Standing by · Night |
  | warn (amber) | slowed: staff, morale, worn, refit, storm | Short of staff · Slowed |
  | bad (red) | stopped or cut off: short of an input, broken, not connected | Short of water · Cut off · Broken |
  | info (blue) | blueprint, under construction | Blueprint · Building 40% |

  The tone comes from a new `roomTone(room, status)` beside `isProblem` in `view/roomState.ts`, so the 3D view's labels could use it later too.
- **Headline chips** (icon, value, tone):
  - A working room: **staff** `👷 3/4` (amber when short) and its **main output** per month (`mainOutput()`, with the resource's icon: `💧 120/mo`).
  - A home: **residents** `4/6` and **happiness** `62 ↑` (red under 50, the trend arrow from `homeRows`).
  - A store or tank: how full it is (`340/500`).
  - Anything else (a corridor-like room, a plaza): the chip it has, or none.

### 3. Alerts

One short line per warning, red or amber, each naming the section it comes from (clicking opens that section and scrolls to it). Examples: "Not connected" (with the **Connect** button beside it, moved up from the body), "Short of water", "Crowded: air −0.4", "18% have no restroom in reach", "Noise −1.6", "Bothers 3 homes". Today's `warn: true` rows become alerts; their full text stays in their section. No alerts, no band.

### 4. At a glance

Chips that wrap onto two lines at most, chosen by what the room is:

- **Condition** as a small meter (the bar it has today, colored by `conditionColor`), with "Being repaired 40%" or the queue place as its tooltip.
- **Felt here**: one chip per neighbor effect felt (noise, smell, air, comfort, wellbeing), as a small signed meter from −3 to +3, red to green, the number beside it.
- **A home**: comfort, noise and wellbeing as signed meters (their sum's parts in the tooltip), and meals and restroom as ✓ or a percentage.
- **A service or amenity**: its reach, `8/12 homes`.
- **Storage**: the stacked bar of goods it has today.

### 5. Sections

Collapsible, each with a title, an icon and a count or warning dot on its header line. Rows inside keep today's label and text, gain an icon and a tone, and move long explanations into tooltips.

| Section | What's in it | Open by default |
| --- | --- | --- |
| **Work** | uses, makes, scrubs, stores (as resource chips: icon and amount), and the controls: running, stop at, priority, crop, holds, tank fill | for rooms with staff |
| **Home** | residents, happiness and each factor's sum of parts (comfort, noise, wellbeing), meals, restroom, within reach, on foot | for homes |
| **Serves** | teaches, rests, cares for, restroom for, seats, reaches | for services and amenities |
| **Surroundings** | felt here in full, bothers, lifts, crowded, windows | when it has a warning |
| **Building** | walls, refit, the construction queue line, condition note, demolish | while under construction |
| **Seed kit** / **Storage** | as today, for the rooms that have them | always |

Any section holding a warning opens too. The player's own open or close wins after that: remembered per section (not per room), so closing Surroundings once keeps it closed on every room. On the web in local storage (wrapped in try/catch, as settings are); in Godot in the viewer's settings file.

### 6. Tooltips, icons and tones

- **Tooltips** carry what's long: the full `roomState` sentence, a factor's breakdown with the rooms behind it (`sourcesText`), the "add windows with Build → Corridors → Windows" hint, the "more than N to a cell gets stuffy" rule.
- **Icons** come from `view/icons.ts`, so Godot gets them through the bridge's `icons` message (`godot/src/Icons.cs`) with nothing extra. It has `workers`, `colonists`, `happiness`, `health`, `condition`, the resources and `alert`; new ones to draw for this: `comfort`, `noise`, `smell`, `air`, `reach` (footsteps), `walls`, `window`, `seat`, `school`, `clinic`, `restroom`, `section` chevrons.
- **Tones** are five named colors (`good`, `idle`, `warn`, `bad`, `info`) defined once: as CSS tokens on the web, and as `Color` constants in `Inspector.cs` from the same hex values. The model only ever says a tone's name.

### 7. One model, two viewers

`view/roomPanel.ts` grows a `panelModel(s, room)` that returns the whole panel as data:

```ts
type Tone = "good" | "idle" | "warn" | "bad" | "info";
type SectionId = "work" | "home" | "serves" | "surroundings" | "building" | "kit" | "storage";

interface Meter { value: number; max: number }        // 0..max, e.g. condition, staff
interface Signed { value: number; range: number }     // −range..+range, e.g. noise −1.6 of 3

interface Chip { icon: IconId; value: string; label: string; tone?: Tone; meter?: Meter; signed?: Signed; tip?: string; section?: SectionId }
interface Row { k?: string; text: string; warn?: boolean; icon?: IconId; tone?: Tone; signed?: Signed; tip?: string }
interface Alert { text: string; tone: "warn" | "bad"; section: SectionId; action?: "connect" }
interface Section { id: SectionId; title: string; icon: IconId; open: boolean; rows: Row[]; chips?: Chip[] }

interface PanelModel {
  status: { text: string; tone: Tone; tip: string };
  headline: Chip[];
  alerts: Alert[];
  glance: Chip[];
  sections: Section[];
}
```

The controls stay where they are now (separate parts of the `inspected` message on Godot, components on the web), each placed in the section it belongs to by id. `Row.text` stays a complete sentence, so the flat list (tests, bots, the Why? panel's links) keeps working and anything the viewers don't draw yet still reads. `panelRows` stays as a thin flattening of the model until nothing calls it.

### 8. Sketches

At the inspector's width (~300 px). `[ ]` is a chip, `▮▮▯` a meter, `▸`/`▾` a closed or open section.

A home with a problem:

```
Riverside Flats ✎                         ×
Standard home · floor 3
(● Running)   [👥 4/6]  [☺ 48 ↓]
─────────────────────────────────────────────
⚠ Noise −1.6: Smelter −1.2, Pump −0.4        → Home
⚠ 18% have no restroom in reach               → Home
─────────────────────────────────────────────
[▮▮▮▮▯ 82%]  [comfort ▸+0.5]  [noise ◂−1.6]
[wellbeing ▸+0.2]  [meals ✓]  [restroom 82%]
▾ Home                                     ●
   Happiness   48 ↓, heading for 41
   Comfort     +0.5 = view +1, no seat −0.5
   Noise       −1.6 = Smelter −1.2, Pump −0.4
   Wellbeing   +0.2
   Meals       a seat for everyone in reach
   Restroom    18% without one in 6 steps
   On foot     Park 4 steps, Gym 7 steps
▸ Surroundings                             3
▸ Building
```

A farm short of water:

```
North Farm ✎                               ×
Farm · floor 2
(● Short of water)  [👷 3/4]  [🌾 90/mo]
─────────────────────────────────────────────
⚠ Short of water                          → Work
─────────────────────────────────────────────
[▮▮▮▮▮ 96%]  [smell ◂−0.3]
▾ Work
   Uses      [💧 40] [⚡ 6]
   Makes     [🌾 90] [O2 12]
   Crop      [Potatoes (tuber, 30/day)   ▾]
   Priority  [Normal ▾]   ☑ Running  ☐ Stop at
▸ Surroundings                             2
▸ Building
```

A tank:

```
Water Tank 2 ✎                             ×
Tank · floor 1
(● Running)  [💧 340/500]
─────────────────────────────────────────────
[▮▮▮▮▯ 88%]
▾ Work
   Holds     [Clean water ▾]
   Stores    [💧 500]
▸ Building
```

### 9. Where other work slots in

- **T-157** (room upgrades in the panel, F-017) adds an Upgrades block to **Building**, or its own section if it lands first and has many rows.
- **T-035** (material looks and the Upgrade control in Godot, F-003): the refit control goes in **Building**.
- **T-147** (the happiness tooltip on the HUD) is the hole-wide twin of the Home section's happiness row; the two should use the same factor words.
- The **Why? panel** (T-171–T-175): an alert can link to it when the cause is hole-wide.

## Steps

Each is one PR that leaves both viewers working.

1. **The panel model** (M). `panelModel()` in `view/roomPanel.ts`, `roomTone()` in `view/roomState.ts`, the new icons in `view/icons.ts`; the bridge sends the model in `inspected`. Both viewers still draw the same flat rows from it, so nothing changes on screen yet. Tests: every room in the dev saves gives a model; every row today's `panelRows` gives lands in exactly one section; every warning is also an alert.
2. **Header and alerts** (M). Status pill and headline chips, then the alerts band with Connect moved into it; the old state line goes, and condition moves to the glance band. Web and Godot.
3. **Collapsible sections, with the controls in them** (M). Sections with their open rule and the remembered open state, rows with icons and tones; crop, holds, tank fill, priority, running and stop at, refit and demolish move into Work and Building. Web and Godot.
4. **At a glance, meters and tooltips** (M). The glance chips, signed meters for felt effects and a home's factors, resource chips in Work, and the long text moved into tooltips. Web and Godot.
5. **Copy pass** (S). With the labels, icons and tooltips carrying meaning, shorten each row's text, check every room family on screen in both viewers, and update the screenshots in GUIDE.md.

## Docs each step updates

- `docs/GUIDE.md`: the room panel section (step 2 onward).
- `docs/PLAN-GODOT.md`: nothing to add to "Status and next", since Godot keeps pace; note any part that lags.
- This plan's Notes as built.

## Open questions

- [x] Remember the open sections across rooms, or reset to the defaults for each room? → Remembered (Bryon, Oct 25).
- [x] Demolish at the bottom of Building, or behind a ⋯ menu in the header? → The bottom of Building (Bryon, Oct 25).

## Notes as built

**Step 1, the panel model ([#306](https://github.com/bdizzz/downtown-mars/issues/306)).** `panelModel(s, room)` in `view/roomPanel.ts` returns the types in §7 (`Tone` lives in `view/roomState.ts`, beside `roomTone()` and `statusWord()`, the pill's few words). Nothing on screen changed: both viewers still draw `panelRows`.
- One list feeds both. `panelEntries()` (private) makes every row once, in today's order, tagged with its section and whether it comes before or after the seed kit. `panelModel` groups them into sections; `panelRows` keeps today's order. The rows are the same objects in both, so a row's icon and tone show up in the flat list too (the viewers ignore them for now). A test checked every room in the four dev saves against main's `panelRows`: same labels, text and warnings.
- Rows get an icon from their label (`ROW_ICONS`). A warning row also gets the `warn` tone, and its section opens.
- **Alerts:** first the room's own state, when its tone is `bad` or `warn` (the `roomState` sentence; "cut off" carries `action: "connect"` and points at Building), then one per warning row, as "Label: text".
- **Headline:** a home shows residents and happiness. A working room shows staff and its `mainOutput` a month (resources without an icon of their own use `machinery`). A storage room shows `used/space`. A tank shows what it stores, not how full it is, because the sim keeps no per-tank fill (only the hole's stock against its total capacity). Step 2 can revisit that.
- **Glance:** condition (tone from `CONDITION.wornBelow`, with the repair note as its tip). Then a home's comfort, noise and wellbeing as signed meters (±3), plus meals and restroom; any other ring room gets what's felt there. A service or amenity adds its reach.
- **Sections:** a section shows when it has rows or holds controls (Work for staffed rooms, crops, tanks and tank fill; Building for anything buildable or lined; the kit; storage). It's open by default by kind of room, or when it holds a warning.
- **New icons:** `comfort`, `noise`, `smell`, `air`, `reach`, `walls`, `window`, `seat`, `school`, `clinic`, `restroom`, `crate` and `chevron`. Godot gets them through the `icons` message as usual.
- The bridge sends the model as `inspected.model`. Godot doesn't read it yet, so it needed no C# change.
- A room with no work (the landing pod) has no state line and no status pill (text `""`, tone `idle`), just as it has no state line today.

**Steps 2 and 3, header, alerts and sections ([#307](https://github.com/bdizzz/downtown-mars/issues/307), [#308](https://github.com/bdizzz/downtown-mars/issues/308)), built together in one PR.** Both viewers now draw the panel from `panelModel`; the flat `before`/`after` rows and the state line are gone from the bridge's `inspected` message (`panelRows` stays for the tests and bots).
- **Header:** the status pill (tone color, `roomState` sentence as tooltip) and the headline chips (icon and value in the chip's tone, label and tip as tooltip). The title's floor badge stays on the web; Godot keeps its "Bunk dorm · floor 3" subtitle.
- **Alerts:** one line each, clipped to one line with the whole text as its tooltip (the full sentence is still in its section; the copy pass, step 5, shortens them). Each has a "→ Section" button that opens that section and scrolls to it. Connect sits on the cut-off alert (web) or under the band (Godot), as "Connect with a corridor (rock)" there.
- **Glance:** only condition so far, the bar and repair note it had; the other glance chips come with step 4.
- **Sections:** fold with a chevron; the header shows a warning dot, or the row count while closed. Rows have their icon (dimmed, or in the row's tone). Controls went where §5 puts them: crop, holds, tank fill, priority, Running and Stop at in Work; construction (with Priority construction and Cancel the refit), Walls, Refit and Demolish in Building; the kit and storage editors in their own. Building now also shows, and opens, for any room with a job in the construction queue (a refit), not only blueprints and rooms being built.
- **Remembered open state:** the player's open or close wins over the model's default, per section across all rooms: on the web `useOpenSections` in `ui/settings.ts` (its own local-storage key, read and written in try/catch); in Godot `ViewSettings.PanelSections`, saved in `user://settings.cfg` under `[panel_sections]`. Opening a section from an alert counts as opening it.
- **Tones:** CSS tokens `--tone-good/idle/warn/bad/info` in `styles.css`, and the same hex values in `Inspector.cs`'s `Tones`.
- Godot still has no tank fill slider (it never had one); that gap is unchanged.

**Steps 4 and 5, at a glance and the copy pass ([#309](https://github.com/bdizzz/downtown-mars/issues/309), [#310](https://github.com/bdizzz/downtown-mars/issues/310)), built together in one PR.** That finishes the feature.
- **Glance band:** both viewers draw `model.glance` as chips with a 3 px meter under each. A `Meter` fills from the left, and a `Signed` fills from the middle out over ±range with a tick at zero, in the chip's tone. Condition is now one of these chips (repair note as its tooltip), so the bridge's separate `condition` part is gone. A home's comfort, noise and wellbeing chips carry their full breakdown as the tooltip. Storage has no glance chip: the headline already shows its fill, and the Storage section its stacked bar.
- **Rows say less, tooltips say the rest.** `Row.text` is now short, and `Row.tip` holds the long version: a factor's sum names its biggest two parts and the tooltip has all of them with the rooms behind each; On foot lists the first three places and the tooltip their effects; Reaches gives the count and the tooltip the homes; Meals, Restroom, Crowded, Windows (none yet), Teaches, Cares for, Rests, Restroom for and Seats moved their second clause into the tooltip. An alert carries its row's tip. The web shows tips as `title`, with a help cursor on rows that have one; Godot uses the RichTextLabel's hints (dotted underline).
- **Resource chips:** Uses, Makes, Scrubs and Stores rows carry `chips` (the resource's icon, or machinery, and the amount), which both viewers draw in place of the text; the text stays for the flat list.
- **Copy fixes from reading every room family in the four dev saves:** quiet hours' `ordinance` limit read as "Short of ordinance" (as if it were a resource); it's now "Slowed" (amber), "slowed by an ordinance: noisy rooms work slower". A room at full rate with a leftover limit (an electrolyzer at 100% "short of power") shows Running in green, as `isProblem` already had it. A room under construction no longer raises a red "cut off" alert. A factor at nothing says "none" (its chip "0", not "+0"), and happiness that isn't moving says "steady" instead of "heading for" the same number.
- GUIDE.md has no screenshots of the panel to update; its room panel paragraph describes the new layout instead.
