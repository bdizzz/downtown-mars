# Plan: individual colonists

Goal: every colonist is a person with a home, a job, an age, needs, traits, relatives and a daily route, instead of a share of a cohort. Feature [#521](https://github.com/bdizzz/downtown-mars/issues/521); this plan is its first task, [#522](https://github.com/bdizzz/downtown-mars/issues/522). Inspiration: SimTower (people with a home and a job, and a stress colour), RollerCoaster Tycoon 2 (thousands of guests, each with thoughts you can click), Tropico (every citizen has a card with a family, a job, a home and their reasons).

**Verdict: go.** Tracking every person is cheap. At 10,000 people a hole it costs about 0.4 MB of memory, a tenth of a millisecond for the monthly needs update and about a millisecond for the daily swap check. Three things in today's code don't scale and have to be fixed first or alongside: the route search's queue, the saves, and the snapshot. None needs a level of detail, so cohorts can go everywhere, as decided.

## Decided (Bryon, Nov 18)

- If the plan holds up, individuals replace cohorts **everywhere** and DECISIONS.md is reversed. No level of detail that keeps cohorts for some holes.
- **Homes and jobs assign themselves.** The player sees people but doesn't move them. Each person keeps the walk between work and bed short; a person only takes a free bed (nobody is turned out); now and then two people swap beds when both gain, and only after both have been better off for a few days, so beds don't churn.
- **Money per person waits for currency**, as the after-the-break rooms do.

Later the same day, on the three things that don't scale (see "Heading off the hangups"):

- **Saves move to IndexedDB now**, packed and gzipped, in one task, before people are in them. localStorage keeps only settings and the slot list.
- **Route searches are per room, never per person**, on a binary heap.
- **Saves hold only what can't be rebuilt**: who someone is, their home, job, household and age. Commutes, needs and happiness are worked out again on load.
- **The snapshot carries totals, never people**, and the cohorts come out of it now, as a small task of its own.
- **Speed tests in CI are generous** (about 5× today's numbers), so only big jumps fail; size tests (save, snapshot) are strict.

## Where it stands today

- **Cohorts** (`sim/people.ts`): a hole's colonists are a few groups of `{ stage, count, until, gen }`, five people each when they arrive (`data/people.json` `cohortSize`). A cohort moves on as a whole: children grow up, adults retire, elders pass away. `population.count` is their sum. The dev saves have 6 to 25 cohorts a hole.
- **Notables** (`sim/notables.ts`): up to 20 made-up people a hole (`data/notables.json`), with a name, a role, two traits and loyalty. They come to the office (`sim/visits.ts`) and get quoted in the newsletter (`sim/newsletter.ts`). They aren't anyone in the cohorts.
- **Homes** (`sim/happiness.ts`): every 10 ticks each home works out its parts (noise, comfort and health from its neighbours, windows, wear, amenities, care, the hole's health, ordinances…), and the hole's people pour into the best homes first. A home's residents are a count, not people. The hole's average happiness sets everyone's productivity.
- **Jobs** (`sim/economy.ts`): every tick the hole's adults are poured into rooms in priority order. Nobody has a job; a room has a staff count.
- **Walking** (`sim/paths.ts`, `sim/amenities.ts`): the sealed network is a graph; `walkFrom(layout, home)` caches each home's walking distances (to everything within the longest reach) until the layout changes. Seats, restrooms, clinics, schools and elder care go to the nearest homes first (`servedByHome`, `sanitationByHome`, `care.ts`).
- **Walkers** (`render3d/people3d.ts`): up to 60 figures on the gallery tubes (one per 3 colonists) and up to 600 seated in rooms, chosen at random. They're nobody.
- **Sizes reached:** the scripted network bot reaches about 70 people a hole by day 120 (the dev saves). DECISIONS.md plans for "a few dozen to 10,000+".

## What it costs: measured

`node scripts/bench-people.mjs` (throwaway; `scripts/bench-people.ts`). Part A times the real path and happiness code on the dev saves; part B grows a synthetic hole of the same shape (floors of corridor loops with stairs, rooms hanging off them) to 50, 1,000 and 10,000 people, with homes of 6 beds, workplaces of 4 staff and galleys of 20 seats, and runs the work this plan adds on it. Apple M4, Node 24, one core; the sim runs in its own worker, so none of this blocks drawing.

**Today, on the dev saves** (65–68 people, 41–51 rooms, 85–113 path nodes): one route search 0.04–0.05 ms; a search from every room 2 ms; `updateHappiness` 0.2–0.4 ms. The saves run about 1.4 path nodes a person.

**Per hole, at three sizes:**

| People | Path nodes | Memory (people) | Route search, binary heap | Route search, today's queue | Assign everyone from scratch | Daily swap check | Monthly needs | Work→home table | Save, people only |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 50 | 2 KB | 0.01 ms | 0.02 ms | 0.04 ms | 0.02 ms | 0.01 ms | — | 3 KB (1 KB gzipped) |
| 1,000 | 920 | 41 KB | 0.02 ms | 0.24 ms | 5 ms | 0.1 ms | 0.03 ms | 49 KB | 60 KB (14 KB gzipped) |
| 10,000 | 9,170 | 410 KB | 0.15 ms | 5–7 ms | 0.5–0.7 s | 0.9–1.4 ms | 0.1 ms | 4.8 MB | 616 KB (126 KB gzipped) |

Placing 60 walkers along people's routes is about a microsecond at any size.

**Across several holes** (the network): everything per person scales with the total, and the per-hole work can be spread over the day, one hole per tick.

| | 10 holes × 1,000 | 10 holes × 10,000 |
| --- | --- | --- |
| People in memory | 0.4 MB | 4 MB |
| Monthly needs, all holes | 0.3 ms | 1 ms |
| Daily swap checks, all holes | 1 ms | 10–14 ms a game day (about 1 ms a tick, spread) |
| Work→home tables, full | 0.5 MB | **48 MB**: too much; keep the nearest 64 homes a workplace instead, ~4 MB |
| Save, people only | 0.6 MB plain, 0.14 MB gzipped | **6 MB plain**: over localStorage's ~5 MB; 1.3 MB gzipped |
| Assign everyone from scratch | 50 ms | 5–7 s: never all at once (see below) |

**What the numbers say:**

1. **People are cheap to hold and update.** About 41 bytes a person as packed arrays. The monthly needs update reads each person's home, job and galley values (worked out per room, as now) and adds their own parts; it's a tenth of a millisecond at 10,000.
2. **The route search's queue doesn't scale.** `paths.ts` keeps its queue as a sorted array, re-sorted on every step ("Small graphs: a sorted array does fine"). That's true today, but at 10,000 people it's 35–45× slower than a binary heap (5–7 ms against 0.15 ms a search). With a heap, a search from every workplace is affordable; without one it isn't. A small, separate fix that helps the current game too.
3. **Assignment must be incremental.** Placing every person from scratch is half a second at 10,000 (one route search a workplace, then each of its staff into the nearest free bed). That's fine once, but not every time the layout changes. Assignments are saved, so loading needs none; a new room, a closed room or a new person only touches the people it affects (one search, a few moves).
4. **Saves outgrow localStorage.** Saves are plain JSON in localStorage (`ui/saves.ts`), which holds about 5 MB an origin across all slots. The late dev save is 220 KB for two holes; one hole of 10,000 people adds 616 KB, and a network of big holes passes the limit. Pack each column as base64 of its typed array, gzip the save with the browser's `CompressionStream`, and keep it in IndexedDB. (Godot's bridge saves to files and doesn't have the limit.)
5. **The snapshot can't carry people.** The worker posts a snapshot of the hole in view 20 times a second, and today it includes the population whole (cohorts and all). People stay in the worker: the snapshot carries counts, the 60 walkers' people and the person the player has open; the people list is asked for when the panel opens.
6. **A full work→home table is too big across many holes.** Keeping each workplace's distance to every home is 4.8 MB a hole at 10,000. Keeping only the nearest 64 homes a workplace (enough for a swap to find a partner) is about 0.4 MB a hole.

## Heading off the hangups

Each of the three becomes a rule here and a test in CI, so the question of scale doesn't rest on anyone remembering it.

### Route searches

- **The rule:** route searches are per room, never per person. A person reads a cached distance; a search runs only when the layout changes, and only from the rooms it touches. Searches then grow with rooms (hundreds), not people (thousands).
- **The fix:** `paths.ts`'s queue becomes a binary heap. Distances come out the same, so today's tests prove nothing changed. It goes first, as its own task, and speeds up the current game's amenity and care searches too.
- **The test:** a synthetic 10,000-person hole, a search from every workplace, inside a generous time limit (about 5× today's). A per-person search added later turns CI red.

### Saves

- **What's saved:** only what can't be rebuilt. Identity (name, traits, generation), birth and next-stage ticks, home, job, galley and household. Commutes, needs and happiness are worked out again on load, as the path caches are now. That's about 25 bytes a person.
- **How:** each column as base64 of its typed array, not a JSON list of numbers; the whole save gzipped with the browser's `CompressionStream` (and `DecompressionStream` to load). A 10,000-person hole should come to 100–150 KB (the benchmark measured 126 KB gzipped for the fuller 41-byte record as JSON).
- **Where:** IndexedDB, which holds hundreds of megabytes; localStorage keeps only settings and the list of slots. Old saves are copied across the first time the game loads, and left in place until the copy reads back. Saving becomes asynchronous (compression is anyway), so the save and load paths in `ui/saves.ts` become async; that's done once, while saves are small.
- **The test:** a bot game grown to a fixed size must save under a set size, exactly.
- **Godot:** the bridge saves to files and isn't affected; it reads the same packed format.

### The snapshot

- **The rule:** the snapshot carries totals (counts by stage, average happiness and its causes, births, the upcoming stage changes as a short summary), never a list of people. The cohorts come out of it now, before any people exist.
- **People on request:** the worker answers two new messages: a page of the people list (sort, filter, offset, 50 rows) when the people panel is open, and one person's card when a walker or a row is clicked. The bridge answers the same messages for Godot.
- **Walkers:** the 60 people behind them are picked again once a game day; the snapshot carries their ids, not their records.
- **The test:** the snapshot's size is the same at 50 people as at 10,000.

## What each person holds

Packed columns (typed arrays, indexed by person), not objects. Ids are stable for the person's life and never reused.

| Field | Type | What |
| --- | --- | --- |
| `born` | Int32 | tick born (or arrived, with an age); age and life stage follow |
| `until` | Int32 | tick of the next stage: grows up, retires, passes away |
| `stage` | Uint8 | child, adult, elder |
| `gen` | Uint8 | generation, as cohorts have now |
| `home` | Int32 | room id, or none (homeless) |
| `job` | Int32 | room id, or none (child, elder, out of work, away) |
| `food` | Int32 | the galley or canteen they eat at, or none |
| `household` | Int32 | household id: who they live with and grieve for |
| `first`, `last` | Uint16 | indexes into the name pools (as notables' names now) |
| `traitA`, `traitB` | Uint8 | two traits, from the notables' trait list |
| `comfort`, `fed`, `health` | Int8 | their needs, in tenths of a factor (−30..+30) |
| `happiness` | Uint8 | 0..100, eased toward their target |
| `workM`, `foodM` | Uint16 | metres on foot: home to work, home to food (cached) |
| `gainDays` | Uint8 | days in a row a swap would have helped them |
| `flags` | Uint8 | notable, away, injured, newly arrived… |

About 41 bytes. Households are a small table of their own (a home, members, a grief value). Notables keep their loyalty and role in a short side table keyed by person. **Money** isn't held until currency comes.

## The corners to cut

- **Routes are distances, not walks.** Nobody walks their route each day. Each person's home→work and home→food distance is worked out when their home, job or the layout changes, and cached (`walkFrom` already caches homes' distances; work beyond the longest reach needs an unbounded search from the workplace). Commutes feed happiness as a number.
- **Needs update monthly** (once a game day), and when a person's home or job changes. Per-room parts (neighbours, wear, windows, amenities) are still worked out per room every 10 ticks, as now; people only add their own parts on top.
- **Walkers are a sample.** The 3D walkers become real people: 60 picked from those whose home or work is on the gallery runs being drawn, so clicking one opens someone real. They keep today's gallery-run movement at first; walking their actual route is a later polish.
- **Swaps are sampled.** Each day, each working person looks at a few (8) homes nearer their work and asks whether someone there would gain from swapping too. A pair that gains for `swapAfterDays` days in a row (data, say 5) swaps. Nobody else moves, and nobody is turned out of a bed.
- **Assignment is incremental.** Only the people a change touches move: a new home takes the nearest unhoused or worst-commuting people; a closed room's people look for the next free bed or job.
- **Aging is a daily scan**, not per tick: 10,000 comparisons a day is nothing.
- **Deterministic:** every roll comes from `hash01` of the hole, the tick and the person's id (as cohorts' spans do now), never the hole's random stream, and ties break by id, so runs replay exactly.

## What replaces cohorts, system by system

| System | Today | With individuals |
| --- | --- | --- |
| **Births** (`births.ts`) | expected births a day from the adult count; needs a clinic, happiness and a free bed | the same rate, but each birth picks a household with an adult couple (happier and roomier ones likelier); the baby takes a bed in that home, or the nearest free one |
| **Aging** (`people.ts`) | a cohort moves on as a whole when its `until` comes | each person on their own `until`; elders pass away one by one, so the newsletter and kin feel each one |
| **Migration** (`migration.ts`) | the youngest adults leave an unhappy hole | the unhappiest adults leave, with their household; they arrive in the new hole as the same people, keeping their names |
| **Arrivals** (`earth.ts`, convoys) | `addAdults` makes cohorts of 5 | new people, some arriving as couples; households form from arrivals who share a home |
| **Happiness** (`happiness.ts`) | each home a pool with a count, filled best home first; hole average from homes | each person's target = their home's parts + their own (commute, food distance, job room's comfort, grief for kin, traits); the hole average and its causes are the mean over people, so the diagnosis still reads the same |
| **Staffing** (`economy.ts`) | adults poured into rooms each tick by priority | people hold jobs; a room's staff is who works there and isn't away. Priorities still decide who's pulled when short: raising a room's priority takes the nearest workers from the lowest-priority rooms |
| **Productivity** | the hole's average happiness slows every room | the same at first (in balance terms, the safe step); later, a room's own staff's happiness could slow that room alone |
| **Amenities, seats, care** (`amenities.ts`, `care.ts`) | shared out to the nearest homes first | unchanged, per home; a person's galley is the nearest one with a seat for their home |
| **School and elder care** | each unschooled child upsets `familySize` people | each unschooled child upsets their own household; each uncared elder, their own kin |
| **Grief** | unrested dead weigh on the whole hole | kin grieve hard and briefly; the hole grieves a little, as now, for the unrested |
| **Notables and visits** (`notables.ts`, `visits.ts`) | 20 made-up people | real people, flagged: chosen for their role (work, household) and kept as long as they live in the hole; a visit's complaint can name their own home or job |
| **Newsletter** (`newsletter.ts`) | quotes notables; babies named from name pools | babies are real, with their parents' last name; the neighbour of the month can be anyone, with their real home and job |
| **Events** (`events.ts`) | away and injured workers are counts | they're people, who come back (or don't) by name |
| **Failure, milestones, history** | read `population.count` and cohort counters | the same counters, kept as people change |
| **Saves** (`save.ts`) | cohorts and notables in JSON | packed people columns and households; a breaking change, with old saves turned into people on load (each cohort becomes its count of people, with spread ages) |
| **Snapshot, bridge, Godot** | population whole | counts, walkers' people, the open person; the list on request |

## Balance

- **Averages become distributions.** Today a home's residents all feel its number; with people, two neighbours can differ by their commute, kin and traits. The hole's average stays the headline, and the threshold rules (births at 50, migration below 45) read it as now, so the first steps change nothing.
- **The commute is a new pull.** It starts at zero weight in shadow mode, then grows with the bots watching: long walks should cost a little, not reshape every layout.
- **Who leaves changes most.** Unhappy people leaving one by one (and their households with them) can drain a hole whose average is fine. Migration's share and limits will need retuning against the bots.
- **Every step lands behind the bots.** The shadow step has to match cohort counts exactly; later steps are tuned with the scripted playthroughs (`tests/bot.ts`, `tests/netbot.ts`, `tests/areabot.ts`) before the cohorts go.

What can't be checked by benchmark: long-game balance, and how the game feels with a name on every figure. Those come from the bots and Bryon's playtests at each step.

## How it shows to the player

- **Click a walker** (or a seated figure) to open their card: name, age, home and job (each a link to the room), commute, their three needs as meters, family in the hole, two traits, and their top reasons for being happy or not (the same causes the diagnosis uses).
- **The people panel** gets a list: everyone, sortable by happiness, age or commute, filterable by unhappy, homeless, out of work; clicking a row opens the card.
- **The room panel** names a home's residents and a workplace's staff.
- **The newsletter and visits** name real neighbours, babies and the departed.
- **Nothing to manage.** Homes and jobs assign themselves; there's no button to move someone.

## Revised breakdown for #521

The proposed tasks mostly hold. The changes: three new tasks the numbers ask for, before people go into the sim, and sharper scopes for the rest.

1. **#532 Route searches on a binary heap** (S, new) (`sim/paths.ts`). No behaviour change; 35–45× faster at 10,000 people; the speed test; the per-room rule in DECISIONS.md. Independent: it can go first.
2. **#533 Saves in IndexedDB, packed and gzipped** (M, new) (`sim/save.ts`, `ui/saves.ts`): async save and load, old localStorage saves copied across, a helper to pack typed-array columns, the save-size test. Before #523.
3. **#534 Totals, not cohorts, in the snapshot** (S, new) (`sim/snapshot.ts`, its readers in `ui/` and `bridge/`): the snapshot-size test. Before #523.
4. **#523 Individuals beside cohorts, in shadow mode** (L): held as packed columns; counts must match the cohorts; people saved with the packing helper, only what can't be rebuilt. A perf test: 10,000 people in a hole, a year of ticks, inside a generous time limit. Blocked by #533 and #534.
5. **#524 Homes and jobs assign themselves** (L): incremental (only who a change touches), with each workplace's nearest 64 homes cached for swaps. Blocked by #532.
6. **#525 Routes as cached distances** (M): reusing `walkFrom` for food and one search a workplace for work; commute weighted zero at first. Blocked by #532.
7. **#526 Needs per person** (L): as proposed; worked out again on load, not saved.
8. **#527 Households and relatives** (M): as proposed.
9. **#528 See a person** (M): the people page and person card as worker messages, not in the snapshot.
10. **#529 Retire cohorts** (L): as proposed; DECISIONS.md reversed here; notables drawn from real people; migration retuned.
11. **#530 Godot** (M): the bridge answers the same people messages.

## Notes as built

- Nov 18: the plan and the benchmark (`scripts/bench-people.ts`, `scripts/bench-people.mjs`). The benchmark is throwaway: it can be deleted once #523's perf test exists.
- Nov 18, later: decisions on the three hangups (saves to IndexedDB now; per-room route searches; totals-only snapshot; generous speed tests, strict size tests) and three new tasks, #532–#534.
- Nov 18, #532: route searches on a binary heap. A heap alone was only about 1.7× faster on the real code (3.7 ms a search at 10,000 people): the string-keyed maps cost more than the queue. So `paths.ts` now also turns each graph into flat arrays (nodes by number, links in runs) on its first search, cached alongside it, and searches those. A search from every workplace of the 10,000-person synthetic hole takes about 0.6 s (0.4 ms a search, against 5.7 ms before); `tests/routeSpeed.test.ts` holds it under 3 s, and checks the distances against the old search.
