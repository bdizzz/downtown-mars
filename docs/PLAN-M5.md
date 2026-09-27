# Milestone 5 plan: people

Goal: colonists stop being a head count. The design's population section (DESIGN.md, Population growth) comes in: three life stages, births once a hole is healthy and happy, aging, and migration between holes. Growth starts to come from within, not only from Earth.

Decided Sep 27, 2026 (Bryon): the game starts with only working adults. Children and elders appear later, through births and aging. Also settled at the end of milestone 4: rooms can be paused or told to stop at a stock level; the staging bay gathers only when asked; the player's own trade routes never sour the giver's opinion.

## Shape of the change

- **Cohorts, not individuals.** A hole's population is a short list of cohorts: a stage (child, adult, elder), a head count, and the tick they move on. It stays cheap at thousands of colonists, and it's deterministic. The total head count everything else uses stays as it is.
- **Only adults work.** Children and elders eat, drink, breathe and need beds, but don't staff rooms.
- **All numbers in `data/people.json`.**

## Defaults (chosen, not yet confirmed)

- **Time scale:** a game day is a real minute, so stages are compressed. Children grow up in 40 days. An adult arriving from Earth works for 60 to 180 days (seeded per group of 5), so the first elders appear around the second hour. Elders live another 30 to 60 days.
- **Old age:** elders pass away peacefully at the end of their span, with a quiet message. Deaths from neglect stay out: an unhappy hole loses people to migration instead (soft failure, as the design says).
- **Births** need a working clinic ("enables births", ROOMS.md), average happiness of at least 55, and a free bed. They come at about 0.6% of adults a day, so 50 adults have a child every three days or so. Newborns join a child cohort for that day.
- **Children** need 70% of an adult's food, water and air. **Elders** need the full amount.
- **School** (M, 3 staff, teaches 40 children, noise −1 r1, brick 15) and **elder care** (M, 3 staff, care for 30 elders, health +1 r1, brick 15, metal 5), from ROOMS.md. Both unlock with their first child or elder, as the catalog says.
  - Children without a school place lower their family's comfort.
  - Elders without care lose health.
- **Migration:** once a day, colonists in a hole whose happiness is below 45 may leave for a happier hole that has free beds, a few adults at a time. They travel like rovers and arrive with a message at both ends. A "Closed borders" ordinance (culture push toward Insular, from DESIGN.md) turns immigrants away. Arrivals count toward the host's opinion of the sender only through culture, not fairness.
- **Earth arrivals, convoy volunteers and migrants are adults.** Volunteers come from the youngest adult cohorts.

## Steps

1. **Cohorts.** Population as cohorts; arrivals, volunteers and new holes use them; only adults staff rooms; save v10 with migration (existing colonists become adults with seeded spans). *See:* the game plays as before, with "20 adults" under Colonists.
2. **Aging.** Adults become elders at the end of their span, and elders pass away at the end of theirs; elders don't work; messages. *See:* in a long game, the first elders appear and the workforce shrinks a little.
3. **Births and children.** Clinic, happiness and bed gates; birth rate; children's needs; children grow into adults. *See:* the first birth in a happy hole with a clinic.
4. **School and elder care.** Two rooms, unlocked by first child and first elder; coverage feeds comfort and health. *See:* the school appears in the palette after the first birth.
5. **People panel.** Stage counts, births and aging ahead, school and care coverage, the reasons births are held back; a breakdown under Colonists in the HUD. *See:* why no babies are coming yet.
6. **Migration.** Unhappy colonists leave for happier holes, travel, arrive; Closed borders ordinance; shown on the map and in the Network panel. *See:* a miserable hole losing people to a better one.
7. **Balance and tests.** The one-hole and two-hole bots updated (clinic, school), a 90-day run, tuning. *See:* population keeps growing after Earth arrivals stop mattering.

## Notes as built
**Step 1, cohorts:** `src/sim/people.ts` keeps a hole's colonists as cohorts `{ stage, count, until }`, with `population.count` kept as their total for everything that reads it. Adults come in groups of 5 (`data/people.json`), each with a working span of 60–180 days. Spans come from a hash of hole, tick and group rather than the hole's random stream, so every existing random event plays out as before. The game starts with 20 adults, and Earth's arrivals are adults. Convoy volunteers are the 12 youngest adults and travel as cohorts; founding also needs 12 adults. Only adults staff rooms. The Colonists tooltip lists stages. Save version 10: existing colonists become adults with fresh spans, and convoys on the road carry adults.

**Step 2, aging:** each tick, cohorts whose time has come move on (`stepAging`, after Earth drops). Adults retire into elders for 30–60 days, and elders then pass away peacefully, with a message in each case; the first retirement says elders will want elder care. Elders don't work. Colonists' needs, waste and restroom water are weighted by stage (`needsWeight`: children 0.7, elders 1, from `data/people.json`), and so is Earth's estimate of what the hole is short of.

**Step 3, births and children:** `src/sim/births.ts`. Births need a working clinic (rooms can declare `enablesBirths`), average happiness of at least 55, a free bed, and two adults. While all four hold, adults have children at 0.6% a day, accumulated each tick. Everyone born on the same day shares one child cohort, which grows into working adults after 40 days (with a fresh working span and a message). The first birth in a hole is announced. `birthBlockers` gives the reasons births are held back, for the People panel. Children need 70% of an adult's food, water and air.

**Step 4, school and elder care:** two rooms from ROOMS.md in the Health and care group:
- **School:** M, 3 staff, power 1, teaches 40, noise −1 r1, brick 15; hotkey E.
- **Elder care:** M, 3 staff, power 1, cares for 30 elders, health +1 r1, brick 15, metal 5; hotkey Q.

Each has a glyph. Holes record unlocks ("children" at the first birth, "elders" at the first retirement), and rooms declare `unlockedBy`. The build check folds deposits and unlocks into one list of "gates", so the palette, previews and build command share one refusal ("Unlocks with the first child born here").

Coverage (`src/sim/care.ts`) is weighted by working staff:
- **Unschooled children:** each upsets a family of 3, and hole-wide comfort falls in proportion, down to −1.5 when every family is affected.
- **Uncared elders:** each weighs on 2 people's health, down to −1.5.

The Inspector shows teaching and care places against the hole's children and elders.

**Step 5, People panel:** a People button in the HUD opens a panel with:
- a stacked bar and counts of children, adults and elders, with how many adults are employed;
- births: the expected pace, a checklist (working clinic, happiness 55+ with the current value, a free bed with beds used), and how many were born here;
- school and care coverage in words;
- the next five cohorts to move on ("5 adults retire in 83 days").

The snapshot gained `stages`, `care`, `births` (blockers, per day, born) and `upcoming`.
