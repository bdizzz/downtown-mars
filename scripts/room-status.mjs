// Writes docs/ROOM-STATUS.md: every room the catalog (docs/ROOMS.md) describes,
// and whether it's built (data/rooms.json), plus what each unbuilt one needs
// first, to help decide what to build next. Run: node scripts/room-status.mjs
//
// The catalog and the room data are read fresh each time; only the notes on
// what an unbuilt room needs are kept here, in NEEDS, by hand.

import { readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const built = JSON.parse(read("data/rooms.json")).rooms;
const catalog = read("docs/ROOMS.md");

const norm = (s) =>
  s
    .replace(/★/g, "")
    .replace(/\(as built\)/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Catalog names that aren't the built room's name. */
const ALIASES = {
  "administration office": "admin_office",
  "elevator": "elevator",
  "local elevator": "elevator",
  "tank": "water_tank",
  "admin desk": null,
  "empty room": "empty_room_m",
};

/** Ladder rungs built under another name (family|size → room id). */
const LADDER_IDS = {
  "Standard apartment|M": "family_apartment",
  "Basic apartment|M": "apartment",
};

/** Catalog rooms built as something a little different, and under another name. */
const BUILT_AS = { "local elevator": true, "empty room": true };

const byName = new Map(built.map((r) => [norm(r.name), r]));
function builtAs(name) {
  const n = norm(name);
  if (n in ALIASES) return ALIASES[n] ? built.find((r) => r.id === ALIASES[n]) : undefined;
  return byName.get(n);
}

/**
 * What an unbuilt room needs first, and how big a step that is:
 * A = nothing new (existing resources and rules), B = one new resource, effect
 * or unlock, C = a new system.
 */
const NEEDS = {
  "Farm atrium": ["C", "H-size (8-slot, 2-floor) rooms; a depth unlock"],
  "Cultured meat lab": ["C", "Food groups in the diet; research lab unlock"],
  Kitchen: ["A", "Splitting cooking (kitchen) from serving (canteen); meals and raw food exist"],
  Canteen: ["B", "Serving capacity as its own step after cooking"],
  Brewery: ["B", "Barley and beer as resources (barley is only a crop today)"],
  "Ventilation hub": ["B", "An air-quality effect (only noise, smell, health and comfort exist)"],
  "Recycling center": ["A", "Solid waste to metal and brick: all exist"],
  "Waste storage": ["A", "Waste storage capacity (waste has base capacity today)"],
  "Geothermal plant": ["B", "A depth unlock (15 floors)"],
  Reactor: ["C", "H-size rooms; a mid-game milestone"],
  "Excavator bay": ["A", "A faster drill (the drill exists)"],
  Brickworks: ["A", "Rock to brick: both exist"],
  "Reinforcement frame": ["C", "Cave-in risk, and unlocking rings 4–6"],
  Glassworks: ["B", "Glass as a resource"],
  "Chemical plant": ["B", "Plastics and methane"],
  "Mycelium vat": ["B", "Mycelium composite"],
  "Textile mill": ["C", "Textiles, fiber crops; the consumer goods chain"],
  "Clothing workshop": ["C", "Consumer goods and colonists' needs for them"],
  "Furniture workshop": ["C", "Consumer goods and colonists' needs for them"],
  "Toy workshop": ["C", "Consumer goods and colonists' needs for them"],
  "Appliance assembly": ["C", "Consumer goods and colonists' needs for them"],
  "Pipe mill": ["C", "Pipelines between holes"],
  "Vehicle works": ["C", "Rovers as a made good (today the rover depot provides them)"],
  Hospital: ["A", "A bigger clinic: care exists"],
  Gym: ["A", "A health effect: exists"],
  Park: ["A", "Comfort effect and a little O2: both exist"],
  "Running track": ["C", "Entertainment; a full-ring room shape; races and festivals"],
  "Research lab": ["C", "Milestones it speeds up"],
  Office: ["C", "The coordination penalty it cancels, and services"],
  Shop: ["C", "Goods and currency"],
  "Market hall": ["C", "Goods and currency"],
  "Currency exchange": ["C", "Mars currency"],
  "Security outpost": ["C", "Safety as a happiness factor"],
  "Security headquarters": ["C", "Safety as a happiness factor"],
  Plaza: ["A", "A bigger small plaza"],
  "Grand plaza": ["C", "H-size rooms; glass; events"],
  "Bar and lounge": ["C", "Beer; entertainment as a happiness factor"],
  Theater: ["C", "Entertainment as a happiness factor; tall rooms"],
  Hotel: ["C", "Tourism"],
  "Experience venue": ["C", "Tourism"],
  "Tour company": ["C", "Tourism"],
  "Spiral stair": ["A", "A stairwell variant with a comfort effect"],
  "Grand staircase": ["B", "Glass; placement inside plazas"],
  Escalator: ["A", "A short, powered stair (commutes aren't modelled, so it would be cosmetic for now)"],
  "Freight elevator": ["C", "Moving goods between floors"],
  "Express elevator": ["C", "Commute times and sky lobbies"],
  "Panoramic elevator": ["C", "Glass; tourism"],
  "Sky lobby": ["C", "Commute times and express elevators"],
  "Elevator upgrade": ["C", "Shaft transit capacity"],
  Corridor: ["—", "Built as edges between rooms, not as rooms (PLAN-M6)"],
};

// Parse the catalog's room tables: sections with a "| Room | Size |" table.
const rooms = [];
let section = "";
let inTable = false;
for (const line of catalog.split("\n")) {
  const h = line.match(/^##\s+(.*)/);
  if (h) {
    section = h[1];
    inTable = false;
    continue;
  }
  if (/^\|\s*Room\s*\|\s*Size/.test(line)) {
    inTable = true;
    continue;
  }
  if (!line.startsWith("|")) {
    inTable = false;
    continue;
  }
  if (!inTable || /^\|\s*---/.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  rooms.push({ section, name: cells[0], size: cells[1], unlock: cells[7] ?? "" });
}

// The size ladders: families with a name at each size, and the housing tiers.
const ladder = [];
const ladderSection = catalog.slice(catalog.indexOf("## Size ladders"), catalog.indexOf("## Food"));
// Only the ladder tables (their header names the sizes), not the housing stats below them.
let inLadder = false;
for (const line of ladderSection.split("\n")) {
  if (/^\|.*S \(1 slot\)/.test(line)) {
    inLadder = true;
    continue;
  }
  if (!line.startsWith("|")) {
    inLadder = false;
    continue;
  }
  if (!inLadder || /---/.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  const family = cells[0].replace(/★/g, "").trim();
  ["S", "M", "L", "H"].forEach((size, i) => {
    const raw = cells[i + 1];
    if (!raw || raw === "—") return;
    const name = raw.split(":")[0].trim();
    ladder.push({ family, size, name, id: LADDER_IDS[`${family}|${size}`] });
  });
}

const sizeOf = (r) => (r.size === "surface" ? "Surface" : r.size);
const described = rooms.map((r) => ({ ...r, b: builtAs(r.name) }));
const catalogIds = new Set(described.filter((r) => r.b).map((r) => r.b.id));
const ladderBuilt = ladder.map((l) => ({ ...l, b: l.id !== undefined ? built.find((r) => r.id === l.id) : builtAs(l.name) }));
for (const l of ladderBuilt) if (l.b) catalogIds.add(l.b.id);
const builtOnly = built.filter((r) => !catalogIds.has(r.id));

const status = (r) => {
  if (!r.b) return r.name === "Corridor" ? "Built differently" : "Described";
  if (BUILT_AS[norm(r.name)]) return `Built as ${r.b.name.toLowerCase()}`;
  const catSize = r.size.split(/[ ,]/)[0];
  return catSize && sizeOf(r.b) !== catSize && !/span|Surface|Shaft/.test(r.size) ? "Built (other size)" : "Built";
};

const out = [];
out.push("# Room status: built vs described");
out.push("");
out.push("Every room the catalog (ROOMS.md) describes, and whether it's in the game (`data/rooms.json`). Generated by `node scripts/room-status.mjs`; rerun it after adding rooms. What an unbuilt room needs first is kept by hand in the script.");
out.push("");
const count = (s) => described.filter((r) => status(r).startsWith(s)).length;
const needTier = (t) => described.filter((r) => !r.b && NEEDS[r.name]?.[0] === t).length;
out.push(`**At a glance:** ${built.length} room types built. Of the ${described.length} rooms in the catalog's tables, ${count("Built")} are built and ${count("Described")} are described only. Of those, ${needTier("A")} need nothing new (A), ${needTier("B")} need one new resource, effect or unlock (B), and ${needTier("C")} need a new system (C).`);
out.push("");
out.push("**Needs, graded:** **A** uses what the game already has (resources, effects, rules). **B** needs one new resource, effect type or unlock. **C** needs a whole new system (goods, tourism, safety, commutes, H-size rooms…).");
out.push("");

out.push("## Catalog rooms");
out.push("");
out.push("| Room | Section | Size | Status | Built as | Needs first | Grade |");
out.push("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of described) {
  const [grade, need] = NEEDS[r.name] ?? (r.b ? ["", ""] : ["?", "Not assessed yet"]);
  out.push(`| ${r.name.replace(/★/g, "").trim()} | ${r.section} | ${r.size} | ${status(r)} | ${r.b ? `\`${r.b.id}\` (${sizeOf(r.b)})` : "—"} | ${r.b ? "" : need} | ${r.b ? "" : grade} |`);
}
out.push("");

out.push("## Unbuilt, by how big a step");
out.push("");
for (const [t, title] of [
  ["A", "A: nothing new needed"],
  ["B", "B: one new resource, effect or unlock"],
  ["C", "C: a new system"],
]) {
  const list = described.filter((r) => !r.b && NEEDS[r.name]?.[0] === t);
  out.push(`**${title}** (${list.length}): ${list.map((r) => r.name).join(", ") || "none"}.`);
  out.push("");
}
// Group the C rooms by the system they wait on.
const systems = new Map();
for (const r of described.filter((x) => !x.b && NEEDS[x.name]?.[0] === "C")) {
  const key = NEEDS[r.name][1];
  systems.set(key, [...(systems.get(key) ?? []), r.name]);
}
out.push("**C rooms by what they wait on:**");
out.push("");
for (const [need, names] of [...systems].sort((a, b) => b[1].length - a[1].length)) out.push(`- ${need}: ${names.join(", ")}`);
out.push("");

out.push("## Size ladder variants");
out.push("");
out.push("The catalog's size ladders name a room at each size in a family. Most families have one size built; the others are variants to add.");
out.push("");
out.push("| Family | S | M | L | H |");
out.push("| --- | --- | --- | --- | --- |");
const families = [...new Set(ladder.map((l) => l.family))];
for (const f of families) {
  const cell = (size) => {
    const l = ladderBuilt.find((x) => x.family === f && x.size === size);
    if (!l) return "—";
    return l.b ? `**${l.name}** ✓` : l.name;
  };
  out.push(`| ${f} | ${cell("S")} | ${cell("M")} | ${cell("L")} | ${cell("H")} |`);
}
out.push("");
out.push(`✓ = built (${ladderBuilt.filter((l) => l.b).length} of ${ladderBuilt.length}).`);
out.push("");

out.push("## Built but not in the catalog's tables");
out.push("");
if (builtOnly.length) {
  out.push("| Room | Id | Size | Category |");
  out.push("| --- | --- | --- | --- |");
  for (const r of builtOnly) out.push(`| ${r.name} | \`${r.id}\` | ${sizeOf(r)} | ${r.category} |`);
} else out.push("None.");
out.push("");

writeFileSync(new URL("../docs/ROOM-STATUS.md", import.meta.url), out.join("\n"));
console.log(`${described.length} catalog rooms, ${ladder.length} ladder entries, ${builtOnly.length} built-only`);
