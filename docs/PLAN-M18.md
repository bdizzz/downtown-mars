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
