# Milestone 16 plan: air as a mix — O2 % of the living volume, the O2 ↔ CO2 loop, gas tanks

Goal: oxygen and CO2 form a stable loop, so once a hole's air is made it doesn't keep costing water. Water turns into oxygen for good **only as the hole's living volume grows**. Feature F-002 (`docs/tickets/F-002-air-mix.md`).

Bryon's design (Oct 4, N-0005, first written up in T-011) is settled; the numbers and the smaller rules below are Claude's defaults, which Bryon agreed on Oct 6. Every one is easy to change in balancing. Every number lives in data (`data/config.json` under a new `air` block, and `data/rooms.json`).

## Where it stands today

- `o2` and `co2` are plain pooled resources in `state.resources` (`data/resources.json`: O2 holds 200, CO2 300 and is waste).
- People need 1 O2 a day (`colonists.needsPerDay`; health −60 a day if unmet) and make 1 CO2. CO2 above `co2DangerLevel` (100) costs 7.5 health a day.
- **Life support** (L, staff 3): water 6 + power 5 → O2 30, and scrubs 30 CO2 down to `co2ScrubFloor` (10) so farms have some. Noise −2. Not in the landing kit; the tutorial asks for it early.
- Farms take CO2 2 → O2 2; parks make O2 1 from nothing.
- Earth drops cover the O2 gap (`dailyGaps` in `sim/earth.ts`); the seed kit carries 60 O2 to a new hole (`data/network.json`).
- Each hole has its own `resources`, so each hole has its own air. That stays.

## The design

### 1. Living volume

Each hole's **living volume** in m³, recomputed when `layout.version` changes (like effects):

- every **excavated cell** (empty space or room, `layout.open`): slot width × room depth × floor height (10 × 10 × 4 = **400 m³**);
- every **built corridor and gallery tube**: its length (`edgeLengthM`) × `corridors.widthM` (3) × floor height;
- the **open shaft** and **unexcavated rock** don't count; nor do surface rooms (landing pad, solar);
- **a domed shaft does** (Bryon, Oct 6): once the shaft dome (M12, from 300 colonists) is built, the shaft's π R² × depth joins the volume, about 1,250 m³ a floor for the starter 10 m shaft. It makes the dome a real air project.

**Pressurizing the dome.** A 10-floor shaft is about 12,500 m³, enough to drop a whole hole's O2 by several points at once, into the "very low" band. So a finished dome first **pressurizes**: the shaft joins the volume only once its share of air is made (21% of its volume, from the O2 reserve first, then the electrolyzers, shown as "Air for new space"). Until then the dome stands sealed and its benefits (walkway, atrium comfort, air +0.5, no storm dust) wait, with "Pressurizing the shaft: 40%" in the HUD and the dome's panel. Dug cells (400 m³ each) are small enough to just dilute.

Rooms are counted by the cells they stand in, so the rule holds however rooms are shaped (and survives F-004's rooms by area: volume is still dug cells). A starter hole is about 10 cells and the floor 1 gallery: roughly **4,750 m³**.

### 2. O2 and CO2 as amounts over the volume, shown as %

- `o2` and `co2` stay resources (amounts in the air), so the ledger, flows and charts keep working. They lose their storage caps: the air takes any amount.
- **O2 % = o2 / (volume × `air.unitsPerM3`)**; the same for CO2. Default `unitsPerM3` **2**, so the starter hole holds about 2,000 O2 at 21%, and 1% of its air is about 95 units. No nitrogen and no overall pressure: the rest of the air is implied.
- **Digging dilutes.** When a cell opens, the same O2 spreads over more volume and the % drops. That's the whole growth cost: the electrolyzer then makes the new air from water.
- A new game starts with its air made: O2 at the target, CO2 at the scrub floor (the landing crew sealed and filled it). `startingStock.o2` goes.

**Bands** (all in `air`):

| | Level | Effect |
| --- | --- | --- |
| O2 target | 21% | what the electrolyzer and the tanks aim for |
| Comfortable | 19.5–23.5% | nothing |
| Low | below 19.5% | health falls (default −10 a day) |
| Very low | below 16% | health falls fast (default −40 a day) |
| High | above 23.5% | fire-risk warning (HUD and a message); a hazard later |
| CO2 harmful | above 1% | health falls (default −7.5 a day, as today), replacing `co2DangerLevel` |
| CO2 dangerous | above 3% | health falls fast (default −30 a day) |
| CO2 scrub floor | 0.2% | scrubbers leave this much for farms (replaces `co2ScrubFloor`) |

"Air quality" stays what it is: the separate, local ventilation effect (M11/M12). The HUD and room panels already say "Air" for both; the mix reads as **"Air 21% O2"** and **"CO2 0.4%"**, and the local effect keeps its overlay name, "Air quality".

### 3. Breathing and burning

People turn O2 into CO2, 1:1, every tick (by `needsWeight`, so children breathe less), whatever the level; O2 just can't go below 0. O2 leaves `colonists.needsPerDay`: shortfall now shows as a low %, not an unmet need.

Anything else that breathes or burns uses the same data, `uses: { o2 }` and `makes: { co2 }` in `rooms.json`. **Default: nothing burns yet** (the smelter and kilns are electric); the hook is there for later rooms.

Plants do the reverse, 1:1: farms take CO2 2 → O2 2 as today, and **parks change to CO2 1 → O2 1** (today they make O2 from nothing, which would slowly push O2 too high).

### 4. Two rooms replace life support

| Room | Size, staff | Uses | Makes | Runs | Noise | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| **Electrolyzer** (new) | M, 1 | water 10, power 6 | O2 40 | while O2 is below the target (after the O2 tanks have released), then on to fill the O2 tanks up to the hole's **tank fill** level; otherwise stands by | −1 | metal 15, machinery 2, electronics 2 |
| **CO2 scrubber** (today's life support, renamed) | L, 3 | power 5 | O2 30 and soil 0.5 from 30 CO2 | while CO2 is above the scrub floor | −2 | as today |

- **The scrubber keeps the room id `life_support`**, renamed in data only. Saves, tests, furniture, layouts, the tutorial and the bots keep working without a migration; its water use goes. (Changing the id touches about 25 files for no player gain.)
- **The electrolyzer's water is gone for good** (F-001: the one deliberate leak besides tailings). It shows in the water charts as its own user.
- "Fully efficient while there's scrubbing capacity": a steady colony with enough scrubbers runs the electrolyzer only as it digs. 20 people make 20 CO2 a day, so one scrubber covers about 30 people.
- New `runsWhile` field for both, so the rule is data, not a special case: `{ "below": "o2Target" }`, `{ "above": "co2Floor" }` (the scrubber's `scrubs` already does the second; `runsWhile` makes "standby" show in the room panel).
- **No scrubber in the landing kit** (Bryon, Oct 6): a new game's air lasts about 5 days before CO2 passes 1%, and the tutorial asks for a scrubber early, as it does for life support today. Furniture: the scrubber keeps life support's; the electrolyzer gets a new model and layout (`scripts/furniture.mjs`, `data/furniture.json`, `data/layouts.json`), plus 2D art.

### 5. Gas tanks: ballast both ways

A **gas tank** room (S, no staff, stores 200; cost metal 8, glass 2) **holds O2 or CO2**, chosen in its panel the way a water tank chooses clean, gray or tailings (T-005) and a farm its crop. Tank contents are separate stocks, `o2Stored` and `co2Stored`, with capacity from the tanks; changing what a tank holds needs it empty (or loses what's in it, see Open questions).

Each tick, in this order:

1. **Release:** if O2 is below the target, O2 tanks release into the air up to the target. If CO2 is below the scrub floor and farms want it, CO2 tanks release for them.
2. **Rooms run** (breathing, farms, parks, scrubbers, then the electrolyzer, which only makes what the tanks couldn't cover). So the tanks save water: the electrolyzer runs only when they're empty.
3. **Store:** O2 above the target goes into O2 tanks with room; CO2 above `air.co2StoreAbove` (default 0.5%: what the scrubbers couldn't keep up with) goes into CO2 tanks.
4. **Overflow:** when the tanks are full, the extra stays in the air. That's how O2 gets too high.

**Stockpiling O2 (Bryon, Oct 6):** once the air is at the target, the electrolyzer can go on filling the O2 tanks, for growth spurts or a scrubber breakdown. One hole-wide **tank fill** slider, 0–100% of the O2 tanks' capacity (default 0%, off), shown in every electrolyzer's and O2 tank's panel; it's one setting because the tanks are one pool. Its O2 goes straight into the tanks, never the air, so it can't push O2 too high. That water is spent for good, like any electrolyzer water; the flow panel shows where it went (below).

O2 above the target comes from what arrives rather than what's made: supply drops and the belt ship's thanks, a seed kit landing in a small new hole, farms working through stored CO2. **Supply drops and seed kits land in the tanks first, then the air.** Earth's O2 gap becomes "O2 short of the target, less what's in the tanks".

**A tank at 0% condition** (gas or water, F-001's tanks too) keeps what it holds but can't take more; what's in it can still be used. Today a room at 0% stops, and a stopped tank's capacity vanishes; instead its capacity counts as exactly what it holds, never more.

### 6. The "vent excess air" event

When O2 has been above 23.5% for half a day (tanks full), an event card (M14 framework, `data/events.json`, trigger in `sim/events.ts`):

> **Too much oxygen.** The air's at 25% O2 and the tanks are full. Fire crews are nervous.
> - **Vent the excess**: O2 back to 21%; what's vented is lost for good.
> - **Hold it**: build tanks instead. The fire-risk warning stays.
>
> Ignored (1 day): it's held.

At most once every 3 days. This is a deliberate exception to "nothing vents to the planet" (DECISIONS.md, M11): the air never leaks on its own; venting is only ever the player's choice.

### 7. HUD, charts and panels

- HUD: **Air 21% O2** (warn below 19.5% or above 23.5%, bad below 16%), **CO2 0.4%** (warn above 1%), with notes: the volume (m³), O2 and CO2 amounts, tank fill, what's making and using each. Health's note keeps CO2 and adds O2.
- Charts (`ui/trends.ts`): O2 % with reference lines at 16, 19.5 and 23.5; CO2 % with lines at 1 and 3; living volume; O2 and CO2 in tanks. Flows: the air loop (people and fires → CO2 → scrubbers and plants → O2; water → electrolyzer → O2; tanks either way; vented).
- **Two-step flows (Bryon, Oct 6).** The flow panel today is one step per resource: sources → the resource → uses. A use can now carry a second step, where it went next. The Water tab's electrolyzer reads:

  > Water → **Split into oxygen** → **Air for new space** · **Replacing breathed air** · **Into the O2 reserve**

  - *Air for new space*: filling volume the hole just dug. The sim keeps a running "new space owed" (each dug cell adds its volume × units per m³ × 21%), and the electrolyzer's O2 pays that off first.
  - *Replacing breathed air*: O2 made below the target beyond what's owed: the scrubbers aren't keeping up, so water is covering for them. A sign to build a scrubber.
  - *Into the O2 reserve*: the tank fill slider's O2.

  The ledger gains it generically (`record(…, { then: "Air for new space" })` keeps a per-use breakdown), so other loops can use it too: F-001's industry water could show "→ gray · tailings". The web panel (`ui/FlowPanel.tsx`) draws the second column; the Godot viewer gets it through `src/bridge/charts.ts`.
- Room panels: the electrolyzer and scrubber show standby; a gas tank shows what it holds and its fill; the electrolyzer and O2 tanks carry the tank fill slider.
- The Godot viewer reads HUD and panel text through the bridge (`src/view/hudItems.ts`, `roomPanel.ts`), so it follows; the electrolyzer's model needs adding there like any new room.

### 8. Saves and the network

- **Migration** (`sim/migration.ts`): an old hole gets its living volume, O2 set to the target and CO2 to the floor (its old pools meant nothing per m³). Life support keeps its id. A save version bump.
- **New holes:** a founded hole starts with the volume its kit blasts out, filled from the seed kit's O2 (60 today, raised to fill a starter hole if needed, tuned in step 6). A small hole with a big kit lands above target: the vent event's first natural trigger.
- **Trade:** O2 keeps its value in `culture.json`; hauling goes tank to tank (the rover takes from `o2Stored`, never the air).

## Steps

Each step is one PR and leaves the game working.

1. **Living volume and the mix.** `sim/air.ts`: living volume, O2 and CO2 %, the bands and health, breathing 1:1, the `air` config block; life support (as is) and the farms/parks feed the air, with life support's O2 stopping at the target; HUD, charts, migration, a new game starting at target. (L)
2. **Two-step flows.** The ledger's `then` breakdown, the second column in the web flow panel and in Godot's charts. Nothing uses it yet but a test. (S)
3. **The electrolyzer and the CO2 scrubber.** Life support renamed and its water dropped; the electrolyzer with `runsWhile` and its flows (new space, replacing breathed air); the domed shaft as volume, pressurized before it opens; furniture, layout, 2D art; parks take CO2; the tutorial and landing kit; Godot model. (M)
4. **Gas tanks.** The room and its O2/CO2 choice (reusing T-005's "holds"), the ballast order, overflow, the electrolyzer's tank fill slider (and its "Into the O2 reserve" flow), drops and kits into tanks, the 0%-condition rule for every tank. (M, after T-005)
5. **Too much oxygen.** The fire-risk warning and the vent event. (S)
6. **Rebalance.** `unitsPerM3`, the electrolyzer's ratio, the seed kit, Earth's O2 gap, the bots: a steady colony uses almost no water for air, and digging shows up as electrolyzer water. A test that pins both. (M)

## Order with other work

- **F-001 / T-005 (water loop)** first, or at least before step 4: gas tanks reuse its tank "holds" choice and its 0%-condition rule covers water tanks; step 3's electrolyzer is one of the water loop's two leaks. Steps 1–3 don't depend on it.
- **F-004 (rooms by area)** changes how rooms map to cells. Volume counts dug cells, not room footprints, so whichever lands second only needs `livingVolume` checked.

## Open questions

See the feature's Open questions (`docs/tickets/F-002-air-mix.md`).

## Notes as built

**Step 1, living volume and the mix (T-026, Oct 6).**

- `sim/air.ts`: `livingVolume` (open cells on dug floors at 400 m³, built corridors and tubes at length × 3 m × 4 m), cached on `state.air` by layout version, open-cell count and corridor counts (corridors finishing don't bump `layout.version`). `airPct`, `airAmount`, `fillAir`, `breathe`, `airHealthLoss`, `airView` (on the snapshot as `air`). The domed shaft isn't counted yet: step 3.
- O2 and CO2 are flagged `air` in `resources.json` and have no capacity (`capacities()` leaves them out). `startingStock.o2`, `colonists.needsPerDay.o2`, `makesPerDay.co2`, `co2DangerLevel`, `co2HealthLossPerDay` and `economy.co2ScrubFloor` are gone; the `air` block in `config.json` holds the rest. `needsMet` no longer has `o2`.
- **Balance for step 1 (Bryon, Oct 6: "fast top-up, softer bands").** At the planned 2 units/m³ a dug cell costs 168 O2, 11 days of 20 colonists' breathing, so with life support at 30 a day the bots suffocated while digging. Dig cost and the 5-day CO2 window are locked together through `unitsPerM3`, so the lever is the maker's speed. Until the electrolyzer (step 3):
  - **Life support tops up fast:** O2 300 from water 60 (the old 5:1), `topsUpAir` (new room field): its O2 stops at the target, and its water is spent only on the O2 it makes. Scrubbing at the target costs power alone, plus the water to remake what's breathed (20 O2, 4 water a day for 20 people), since scrubbing doesn't yet return oxygen (step 3). Its status at the target is `air:o2`, "idling: the air's oxygen is at its target".
  - **Softer bands:** low below **18%** (not 19.5) at −5 a day; very low below **15%** (not 16) at −20 a day. CO2 as planned (1% −7.5, 3% −30, floor 0.2%).
  - With those, the month bot reaches 68 colonists with health no lower than 53 (it dips while the bot digs ~1,600 m³ a day on one life support); the bot health thresholds were eased (60 → 45, child 60 → 40, births 10 → 8) with notes pointing at T-031.
- **New and founded holes** start with their air made (`fillAir`): O2 at the target, CO2 at the floor. A seed kit's 60 O2 lands in the air on top (a small overshoot), until step 4 puts it in tanks.
- **Earth's O2 gap** is breathing less what's made, and only O2 above the target counts as on hand, so a drop also tops the air back up to the target.
- **Save v19:** every hole's air starts over at the target and floor.
- HUD: **Air 21.0% O2** (warns outside 18–23.5%) with a points-a-day rate, and **CO2 0.20%** (warns above 1%), each with its band and amounts in the tooltip. Charts: Oxygen % (lines at 23.5, 18, 15), CO2 % (1, 3) and Living volume, from three new history series (`o2Pct`, `co2Pct`, `airVolume`). Series can now carry `decimals`, and chart axes label as finely as their steps (`seriesNum` in `ui/trends.ts`, shared with the bridge).
- **Merged with the water loop (T-005), Oct 7.** Life support is a sink there (`returnsWater: {}`), which fits. Earth's gap now plans a top-up room's water on its busiest recent day in the ledger, or its full rate before it has a record (one being built included), rather than its full rate always, which sent ~56 water a day too much to every steady colony. The two loops together cost the bots more than either alone; the eased tests are listed in T-031's Context.
- The adaptive bot reads the air by %: life support when CO2 passes 0.5%, scrubbing falls short of the population, or O2 is below the low band with no life support at all (a dip after digging just needs time).

**Step 2, two-step flows** (T-027, Oct 6, 2026):

- `record(state, res, "out", label, amount, { then: "Air for new space" })` adds to the use as before and also to `flows[res].then[label][where]`. `then` is optional on each day's entry, so old saves' ledgers load as they are; `averageFlows` averages it like the rest. A use's `then` needn't cover all of it: what's left over just has no second step.
- `view/flows.ts`'s `river()` returns `thens` by the use's shown label, biggest first, dropping anything under `MIN_FLOW`. The web panel and the bridge both read it, so they agree.
- Drawing: a river with a second step is drawn wider (the web panel widens to 480 px for that tab; Godot's river to 460) with the middle bar moved left; each use's next places stack from the use's own top, joined by fainter ribbons in the use's colour. Use labels sit over those ribbons, with a halo to keep them readable.
- Nothing records a `then` yet; a test in `tests/ledger.test.ts` checks the ledger, `river()` and the bridge's flows message. Checked by hand in both viewers with the colonists' water split three ways (not committed). The electrolyzer (step 3) is the first real user.

**Step 5, too much oxygen** (T-030, Oct 10, 2026), built before steps 3 and 4:

- `checkAir` in `sim/events.ts`, every events check: O2 above `air.o2High` (23.5%) starts `events.o2HighSince` and posts a fire-risk warning (at most once a day, `ventAir.warnEveryDays`, so air bobbing over the line doesn't spam); after `ventAir.afterDays` (half a day) above it, the `vent_air` card, at most once every 3 days. Falling back under the line resets the clock. All in `data/events.json` (`ventAir` and the event).
- No "tanks full" test yet: there are no gas tanks until T-029, and as ballast they'll soak up O2 above the target while they have room, so O2 only climbs this high once they're full. T-029 needn't touch the trigger.
- **Vent the excess** (`ventAir`, a new event effect): O2 down to the target, the rest recorded as the O2 flow's "Vented" use, gone for good. **Hold it** changes nothing; ignored (1 day) it's held. The card's text names the level (`{o2}`, a new placeholder).
- The HUD's O2 alert reads "Fire risk: oxygen at 24.6%" when high (it already warned above 23.5%). `dm.event("vent_air")` raises the card for testing.
