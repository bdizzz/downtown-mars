import { useEffect, useRef, useState } from "react";
import type React from "react";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import type { Tool } from "../view/types";
import { config } from "../sim/config";
import { missingCost, siteRefusal, withExtra } from "../sim/costs";
import { roomDef, roomDefs, type RoomDef } from "../sim/rooms";
import { BUILD_GROUPS, buildTiles, CORRIDOR_KEY, DEMOLISH_KEY, groupOf, groupOfRoom, HOTKEYS, sectionInfo, shapesFor, surfaceOnly, variantLabel, type BuildGroup, type BuildTile } from "../view/buildCatalog";
import { SIZE_NAMES } from "../view/roomCard";
import { RoomCard } from "./RoomCard";
import { Amounts } from "./Cost";
import { Icon } from "./Icon";
import { corridors, finishDef } from "../sim/corridors";
import { liningById, liningCost, liningId, MATERIALS, wallStep } from "../sim/materials";
import { resName } from "./format";
import { freshClass, SHOW_ALL, type Reveal } from "./reveal";

// Building, in two parts. The rail down the left edge: a handful of groups of rooms, each opening a
// short list of tiles beside it (a room, or a family of sizes behind one tile), with the details of
// the tile under the pointer. And the tool bar along the bottom, there only while something is in
// hand: the choices that go with it (its size, which way round, what it's built in; for corridors,
// what the tool does) and nothing else.

/** The lining rooms are built in unless another is picked (T-038). */
export const BARE_ROCK = liningId(MATERIALS.walls[0]!);

/** Cells a room of this shape takes (for what its lining costs). */
function cellsOf(def: RoomDef, shape: [number, number]): number {
  return shape[0] * shape[1] * (def.floors ?? 1);
}

/** Rooms in the hole's rings that take a lining (not surface buildings, stairs, lifts or empty rooms). */
function canLineType(def: RoomDef): boolean {
  return def.size !== "surface" && !MATERIALS.exempt.includes(def.id) && !def.excavationOnly;
}

/** What building a room in this lining adds to its cost, by its first shape (or its shape in hand). Nothing for rooms that can't be lined. */
function liningExtra(def: RoomDef, lining: string, shape = shapesFor(def)[0]!): Record<string, number> {
  const step = liningById(lining);
  if (!step || lining === BARE_ROCK || !canLineType(def)) return {};
  return Object.fromEntries(Object.entries(liningCost(step)).map(([r, v]) => [r, v * cellsOf(def, shape)]));
}

const costWords = (cost: Record<string, number>) =>
  Object.entries(cost)
    .map(([r, v]) => `${v} ${resName(r).toLowerCase()}`)
    .join(", ");

const catColor = (category: string) => ({ "--cat": cssColor(CATEGORY_COLORS[category] ?? 0x888888) }) as React.CSSProperties;

export function buildTool(def: RoomDef): Tool {
  return { kind: "build", room: def.id, shape: shapesFor(def)[0]! };
}

/** The member of each family last picked, this session: its tile picks it up again. */
const lastVariant: Record<string, string> = {};

/** The room a tile hands you: the family's member last picked, else the first this hole can have. */
function tileRoom(tile: BuildTile, deposits: string[]): RoomDef {
  return tile.members.find((m) => m.id === lastVariant[tile.id]) ?? tile.members.find((m) => !siteRefusal(m.id, deposits)) ?? tile.members[0]!;
}

/** The rooms the palette offers, as tiles (the guided tutorial shows only what it has unlocked, T-084). */
function shownTiles(reveal: Reveal): BuildTile[] {
  return buildTiles(roomDefs.filter((d) => d.buildable && reveal.shown(`room:${d.id}`)));
}

/** Why the dome can't be started, as the hole stands (null: it can). */
function domeRefusal(dome: RailProps["dome"], gates: string[], resources: Record<string, number>): string | null {
  if (dome === "built") return "Built: the shaft is air";
  if (dome === "building") return "Under construction (Charts → Construction)";
  if (!gates.includes("dome")) return `Unlocks at ${config.dome.population} colonists in this hole`;
  const short = Object.entries(config.dome.cost).filter(([id, v]) => (resources[id] ?? 0) < v);
  return short.length ? `Needs ${short.map(([id, v]) => `${Math.ceil(v - (resources[id] ?? 0))} more ${resName(id).toLowerCase()}`).join(", ")}` : null;
}

/** The dome's card: what it costs and what it does. */
function DomeCard({ dome, deposits, resources }: { dome: RailProps["dome"]; deposits: string[]; resources: Record<string, number> }) {
  const why = domeRefusal(dome, deposits, resources);
  const d = config.dome;
  return (
    <div className="room-card" style={catColor("public")}>
      <header>
        <span className="swatch" />
        <h3>Shaft dome</h3>
        <span className="size">One per hole</span>
      </header>
      <p className="price">
        <Amounts amounts={d.cost} have={resources} />
        <span className="k">{d.workHours} work-hours</span>
      </p>
      <p className="note k">A glass dome sealing the top of the shaft: a hole's crowning work.</p>
      <p className="fx">
        <span className="fx-chip good" title="Every floor's gallery becomes open walkway: no tubes to lay">Open galleries</span>
        <span className="fx-chip good" title="The shaft is an atrium: comfort for every room facing it">Comfort +{d.atriumComfort}</span>
        <span className="fx-chip good" title="Air quality everywhere; storms no longer drive dust through the airlock">Air +{d.air}</span>
      </p>
      {why ? <p className={`note ${dome === "built" ? "good" : "bad"}`}>{why}.</p> : <p className="note good">Click to start building it.</p>}
    </div>
  );
}

interface RailProps {
  /** Build mode is on: a group is open, or something is in hand. */
  active: boolean;
  /** Turn Build mode on (a group was opened) or off (the open one was closed with nothing in hand). */
  setActive: (on: boolean) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  resources: Record<string, number>;
  canUndo: boolean;
  undo: () => void;
  /** Tutorial highlight, e.g. "room:galley". */
  highlight: string | null;
  /** What this hole sits on: rooms needing a deposit it lacks are greyed out. */
  deposits: string[];
  /** The finish the corridor tool last used. */
  lastFinish: string;
  /** The lining rooms are built in (a liningId; bare rock unless picked). */
  lining: string;
  /** The shaft dome: not yet, under way, or built. */
  dome?: "none" | "building" | "built";
  onBuildDome?: () => void;
  /** Which rooms and tools show (the guided tutorial's unlocks, T-084). */
  reveal?: Reveal;
  /** A group's number key was pressed (1 for the first group…): open it, or close it if it's open. `n` changes with every press. */
  jump?: { group: number; n: number } | null;
}

/** The group a tool belongs to: its room's, or Access for corridors. */
function groupOfTool(tool: Tool): string | null {
  if (tool?.kind === "build") return groupOfRoom(roomDef(tool.room))?.id ?? null;
  if (tool?.kind === "corridor") return groupOf("circulation")?.id ?? null;
  return null;
}

/** What shows under the pointer: a tile's room, or the dome. */
type Hovered = { id: string; top: number; bottom: number; up: boolean } | null;

/**
 * The build rail, down the left edge of the view: a button per group of rooms, then Demolish and
 * Undo. Opening a group (one at a time) lists its tiles beside the rail, and turns Build mode on;
 * choosing a tile (or a room's key) puts it in hand. The details of the tile under the pointer
 * float beside the list, level with it.
 */
export function BuildRail({ active, setActive, tool, setTool, resources, canUndo, undo, highlight, deposits, lastFinish, lining, dome = "none", onBuildDome, reveal = SHOW_ALL, jump = null }: RailProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Hovered>(null);
  const lastOpen = useRef<string | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const tiles = shownTiles(reveal);
  const corridorsShown = reveal.shown("tool:corridors");
  const domeShown = reveal.shown("room:shaft_dome");
  const selected = tool?.kind === "build" ? tool.room : null;
  // The corridor tool, and the bulkhead and window tools that are its modes, each a tile of its own (#454).
  const bulkheadShown = reveal.shown("tool:bulkhead");
  const windowsShown = reveal.shown("tool:windows");
  const bulkheadOn = tool?.kind === "corridor" && !!tool.bulkhead;
  const windowsOn = tool?.kind === "corridor" && !!tool.windows;
  const corridorOn = tool?.kind === "corridor" && !bulkheadOn && !windowsOn;
  if (selected && roomDef(selected).family) lastVariant[roomDef(selected).family!] = selected;

  /** Tools (not rooms) listed in a section: the corridor tool, bulkheads and windows, the dome. */
  const toolsIn = (section: string) =>
    section === "circulation" ? corridorsShown : section === "seals" ? bulkheadShown || windowsShown : section === "public" ? domeShown : false;
  // A group shows once it has something in it: a tile, or a tool.
  const groups = BUILD_GROUPS.map((g) => [g, tiles.filter((t) => g.sections.includes(t.section))] as const).filter(([g, ts]) => ts.length || g.sections.some(toolsIn));
  const pick = (id: string | null) => {
    setOpen(id);
    setHovered(null);
    if (id) lastOpen.current = id;
  };
  // Build mode on with nothing open (its key, B): the group last open, or the first. Off: the list folds away.
  useEffect(() => {
    if (!active) pick(null);
    else if (!tool) pick(lastOpen.current ?? groups[0]?.[0].id ?? null);
  }, [active]);
  // A room chosen by its key opens its group.
  const toolGroup = groupOfTool(tool);
  useEffect(() => {
    if (toolGroup) pick(toolGroup);
  }, [toolGroup]);
  /** Open a group (turning Build on), or close the open one (and Build off, with nothing in hand). */
  const toggle = (id: string) => {
    if (open !== id) {
      setActive(true);
      pick(id);
    } else {
      pick(null);
      if (!tool) setActive(false);
    }
  };
  // A group's number key.
  useEffect(() => {
    const g = jump ? BUILD_GROUPS[jump.group] : undefined;
    if (g && groups.some(([x]) => x.id === g.id)) toggle(g.id);
  }, [jump?.n]);
  // A finger on the view folds the list away, so it doesn't hide where the room goes (the tool stays in hand).
  useEffect(() => {
    const fold = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.target instanceof HTMLCanvasElement) pick(null);
    };
    window.addEventListener("pointerdown", fold, { capture: true });
    return () => window.removeEventListener("pointerdown", fold, { capture: true });
  }, []);

  const wantsTile = (t: BuildTile) => t.members.some((m) => highlight === `room:${m.id}` && m.id !== selected);
  const access = (g: BuildGroup) => g.sections.includes("circulation");
  const toolWanted = (highlight === "tool:corridors" && !corridorOn) || (highlight === "tool:bulkhead" && !bulkheadOn) || (highlight === "tool:windows" && !windowsOn);
  const wanted = (g: BuildGroup, ts: readonly BuildTile[]) => ts.some(wantsTile) || (access(g) && toolWanted);
  const fresh = (g: BuildGroup, ts: readonly BuildTile[]) =>
    ts.some((t) => t.members.some((m) => reveal.fresh(`room:${m.id}`))) || (access(g) && ["corridors", "bulkhead", "windows"].some((id) => reveal.fresh(`tool:${id}`)));
  /** Where the pointer's tile sits in the list, so its card floats level with it (above it, in the lower half of the screen). */
  const over = (id: string) => (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const box = list.current;
    if (!box) return;
    // In the flyout's own pixels (the card is placed in it): the tile within the list, the list within its panel.
    const flyout = box.parentElement?.parentElement;
    if (!flyout) return;
    const top = el.offsetTop - box.scrollTop + box.offsetTop;
    setHovered({ id, top, bottom: flyout.clientHeight - top - el.offsetHeight, up: el.getBoundingClientRect().top > window.innerHeight / 2 });
  };
  const out = () => setHovered(null);

  const current = groups.find(([g]) => g.id === open);
  const shownDef = hovered && hovered.id !== "shaft_dome" ? roomDefs.find((d) => d.id === hovered.id) : undefined;
  const domeWhy = domeRefusal(dome, deposits, resources);

  return (
    <div className={`build-rail${active ? " active" : ""}`} data-anchor="side">
      <div className={`rail${freshClass(reveal, "mode:build")}`} role="toolbar" aria-label="Build" aria-orientation="vertical">
        {groups.map(([g, ts]) => {
          const isOpen = open === g.id;
          return (
            <button
              key={g.id}
              className={`rail-btn${isOpen ? " open" : ""}${toolGroup === g.id ? " on" : ""}${wanted(g, ts) && !isOpen ? " pulse" : ""}${fresh(g, ts) && !isOpen ? " fresh" : ""}`}
              style={catColor(sectionInfo(g.sections[0]!).color)}
              onClick={() => toggle(g.id)}
              aria-expanded={isOpen}
              title={`${g.name}: ${g.sections.map((c) => sectionInfo(c).name).join(", ").toLowerCase()} (${BUILD_GROUPS.indexOf(g) + 1})`}
            >
              <Icon id={g.icon} size={20} />
              <span className="label">{g.name}</span>
              <kbd>{BUILD_GROUPS.indexOf(g) + 1}</kbd>
            </button>
          );
        })}
        <span className="rail-sep" />
        {reveal.shown("tool:demolish") && (
          <button
            className={`rail-btn tool demolish${tool?.kind === "demolish" ? " on" : ""}${freshClass(reveal, "tool:demolish")}`}
            onClick={() => {
              pick(null);
              setActive(true);
              setTool(tool?.kind === "demolish" ? null : { kind: "demolish" });
            }}
            title={`Demolish a room: half its cost back (${DEMOLISH_KEY}, in Build)`}
          >
            <Icon id="demolish" size={18} />
            <span className="label">Demolish</span>
          </button>
        )}
        <button className="rail-btn tool" disabled={!canUndo} onClick={undo} title="Undo your last placement for a full refund, within a few game hours (⌘Z)">
          <Icon id="undo" size={18} />
          <span className="label">Undo</span>
        </button>
      </div>
      {current && (
        <div className="build-flyout">
          <div className="flyout-panel panel">
            <header className="panel-head">
              <Icon id={current[0].icon} size={15} />
              <h2>{current[0].name}</h2>
              <button className="icon-btn" onClick={() => (pick(null), !tool && setActive(false))} aria-label="Close" title="Close (Esc)">
                <Icon id="close" size={13} />
              </button>
            </header>
            <div className="tiles" ref={list} onScroll={out}>
              {current[0].sections.map((cat) => {
                const ts = current[1].filter((t) => t.section === cat);
                const corridor = cat === "circulation" && corridorsShown;
                const domed = cat === "public" && domeShown;
                const seals = cat === "seals";
                if (!ts.length && !toolsIn(cat)) return null;
                const info = sectionInfo(cat);
                return (
                  <section key={cat} style={catColor(info.color)}>
                    {current[0].sections.filter((c) => c === cat || current[1].some((t) => t.section === c) || toolsIn(c)).length > 1 && <h3>{info.name}</h3>}
                    {corridor && (
                      <button
                        className={`tile${corridorOn ? " on" : ""}${highlight === "tool:corridors" && !corridorOn ? " pulse" : ""}${freshClass(reveal, "tool:corridors")}`}
                        onClick={() => setTool(corridorOn ? null : { kind: "corridor", finish: lastFinish, erase: false })}
                        title="Carve corridors along the borders between rooms, back to the gallery. Refitting them in another lining is in its tool bar."
                      >
                        <span className="swatch" />
                        <span className="name">Corridors</span>
                        <span className="k">per 10 m</span>
                        <Amounts amounts={finishDef(lastFinish).cost} have={resources} />
                        <kbd>{CORRIDOR_KEY}</kbd>
                      </button>
                    )}
                    {seals && bulkheadShown && (
                      <button
                        className={`tile${bulkheadOn ? " on" : ""}${highlight === "tool:bulkhead" && !bulkheadOn ? " pulse" : ""}${freshClass(reveal, "tool:bulkhead")}`}
                        onClick={() => setTool(bulkheadOn ? null : { kind: "corridor", finish: lastFinish, erase: false, bulkhead: true })}
                        title={`${corridors.bulkhead.hint}. Click a built corridor to fit one; with Erase, to take one out, free.`}
                      >
                        <span className="swatch" />
                        <span className="name">{corridors.bulkhead.name}</span>
                        <span className="k">each</span>
                        <Amounts amounts={corridors.bulkhead.cost} have={resources} />
                      </button>
                    )}
                    {seals && windowsShown && (
                      <button
                        className={`tile${windowsOn ? " on" : ""}${highlight === "tool:windows" && !windowsOn ? " pulse" : ""}${freshClass(reveal, "tool:windows")}`}
                        onClick={() => setTool(windowsOn ? null : { kind: "corridor", finish: lastFinish, erase: false, windows: true })}
                        title="Put windows in a room's wall, where it faces the shaft, a corridor or a walk-through room: a home's comfort goes up. Click a wall to glaze it all; with Erase, to take them out, free."
                      >
                        <span className="swatch" />
                        <span className="name">Windows</span>
                        <span className="k">per 10 m</span>
                        <Amounts amounts={config.windows.costPer10m} have={resources} />
                      </button>
                    )}
                    {domed && (
                      <button
                        className={`tile${dome === "built" ? " on" : ""}${domeWhy && dome !== "built" ? " short" : ""}`}
                        onClick={() => !domeWhy && onBuildDome?.()}
                        onMouseEnter={over("shaft_dome")}
                        onMouseLeave={out}
                        aria-disabled={!!domeWhy}
                      >
                        <span className="swatch" />
                        <span className="name">Shaft dome{dome === "built" ? " ✓" : dome === "building" ? " …" : ""}</span>
                        <Amounts amounts={config.dome.cost} have={resources} />
                      </button>
                    )}
                    {ts.map((tile) => {
                      const def = tile.members.find((m) => m.id === selected) ?? tileRoom(tile, deposits);
                      const on = def.id === selected;
                      const missing = siteRefusal(def.id, deposits) ?? missingCost(resources, def.id, liningExtra(def, lining));
                      const key = tile.members.map((m) => HOTKEYS[m.id]).find(Boolean);
                      return (
                        <button
                          key={tile.id}
                          className={`tile${on ? " on" : ""}${missing ? " short" : ""}${wantsTile(tile) ? " pulse" : ""}${tile.members.some((m) => reveal.fresh(`room:${m.id}`)) ? " fresh" : ""}`}
                          style={tile.category !== info.color ? catColor(tile.category) : undefined}
                          onClick={() => setTool(on ? null : buildTool(def))}
                          onMouseEnter={over(def.id)}
                          onMouseLeave={out}
                        >
                          <span className="swatch" />
                          <span className="name">{tile.name}</span>
                          {surfaceOnly(def) && (
                            <span className="surface-mark" title="Surface only: built on the ground beside the shaft, not dug into the hole" aria-label="Surface only">
                              <Icon id="surface" size={12} />
                            </span>
                          )}
                          {tile.members.length > 1 && (
                            <span className="variants" title={tile.members.map((m) => m.name).join(", ")}>
                              {tile.members.map((m) => (
                                <i key={m.id} className={m.id === def.id ? "now" : ""}>
                                  {variantLabel(tile, m)}
                                </i>
                              ))}
                            </span>
                          )}
                          <Amounts amounts={withExtra(def.id, liningExtra(def, lining))} have={resources} />
                          {key && <kbd>{key}</kbd>}
                        </button>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </div>
          {hovered && (shownDef || hovered.id === "shaft_dome") && (
            <div className="build-card panel" style={hovered.up ? { bottom: hovered.bottom } : { top: hovered.top }}>
              {shownDef ? (
                <RoomCard
                  def={shownDef}
                  resources={resources}
                  siteNote={siteRefusal(shownDef.id, deposits) ?? missingCost(resources, shownDef.id, liningExtra(shownDef, lining))}
                  shape={tool?.kind === "build" && tool.room === shownDef.id ? tool.shape : shapesFor(shownDef)[0]!}
                  extra={liningExtra(shownDef, lining, tool?.kind === "build" && tool.room === shownDef.id ? tool.shape : undefined)}
                />
              ) : (
                <DomeCard dome={dome} deposits={deposits} resources={resources} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The materials walls come in, plainest first, and whether each has a fine finish. */
const WALL_MATERIALS = MATERIALS.walls.filter((w) => w.finish === "base");

/**
 * Walls, as two small choices rather than eight: the material, and whether it's finely finished.
 * `per` says what the costs in the tips are for ("a cell", "10 m").
 */
function WallPicker({ value, onPick, resources, costOf, disabled, per }: { value: string; onPick: (lining: string) => void; resources: Record<string, number>; costOf: (lining: string) => Record<string, number>; disabled?: boolean; per: string }) {
  const step = liningById(value) ?? MATERIALS.walls[0]!;
  const fine = step.finish === "fine";
  const fineOf = (material: string) => MATERIALS.walls.find((w) => w.material === material && w.finish === "fine");
  const fineStep = fineOf(step.material);
  const tip = (id: string) => {
    const w = liningById(id)!;
    const cost = costOf(id);
    return `${w.name}: ${Object.keys(cost).length ? `${costWords(cost)} ${per}` : "free"}. Comfort +${w.comfort} in a home, wears ${Math.round((1 - w.wear) * 100)}% slower.`;
  };
  return (
    <span className="tool-group walls" role="group" aria-label="Walls">
      <span className="dock-label">Walls</span>
      <span className="seg">
        {WALL_MATERIALS.map((w) => {
          const id = liningId(fine ? (fineOf(w.material) ?? w) : w);
          const f = finishDef(liningId(w));
          const short = Object.entries(costOf(id)).some(([r, v]) => (resources[r] ?? 0) < v);
          return (
            <button key={w.material} className={`${step.material === w.material ? "on" : ""}${short ? " short" : ""}`} disabled={disabled && w.material !== "rock"} title={tip(id)} onClick={() => onPick(id)} aria-pressed={step.material === w.material}>
              <span className="chip" style={{ background: f.color, borderColor: f.accent }} />
              {resName(w.material)}
            </button>
          );
        })}
      </span>
      {fineStep && (
        <button
          className={`toggle${fine ? " on" : ""}`}
          disabled={disabled}
          aria-pressed={fine}
          title={fine ? `Back to plain ${wallStep(step.material, "base").name.toLowerCase()}` : tip(liningId(fineStep))}
          onClick={() => onPick(liningId(fine ? wallStep(step.material, "base") : fineStep))}
        >
          Fine finish
        </button>
      )}
      {fine && <span className="k">{step.name}</span>}
    </span>
  );
}

/** The lining the refit tool last used, this session. */
let lastRefit = "brick";

interface BarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  resources: Record<string, number>;
  rotate: () => void;
  highlight: string | null;
  deposits: string[];
  lining: string;
  setLining: (lining: string) => void;
  reveal?: Reveal;
}

/** The corridor tool's choices: what it does (draw, bulkheads, windows, refit), in which finish, and the eraser. */
function CorridorBar({ tool, setTool, resources, reveal = SHOW_ALL }: Pick<BarProps, "setTool" | "resources" | "reveal"> & { tool: Extract<Tool, { kind: "corridor" }> }) {
  const has = (id: string) => reveal.shown(`tool:${id}`);
  // Every other mode off: drawing in the corridor's finish, or the mode asked for.
  const { refit, bulkhead: _bulkhead, windows: _windows, ...plain } = tool;
  const { refit: _refit, ...noRefit } = tool;
  if (refit) lastRefit = refit;
  const mode = tool.refit ? "refit" : tool.bulkhead ? "bulkhead" : tool.windows ? "windows" : "draw";
  const per10m = MATERIALS.corridor.perSegment;
  const refitCost = (id: string) => Object.fromEntries(Object.entries(liningCost(liningById(id)!)).map(([r, v]) => [r, Math.round(v * per10m * 10) / 10]));
  const modes = [
    { id: "draw", name: "Draw", shown: true, tip: "Carve corridors: drag along the borders between rooms", to: { ...plain, erase: false } as Tool },
    { id: "refit", name: "Refit", shown: has("refit"), tip: "Refit built corridors in another lining, as rooms are. Click a corridor or drag along several. Back to bare rock salvages half the old lining.", to: { ...plain, erase: false, refit: lastRefit } as Tool },
  ].filter((m) => m.shown);
  const hint =
    mode === "windows" ? "Hover a room's wall: it lights up where windows can go"
    : mode === "bulkhead" ? "Click a corridor to seal it: air and smell stop there"
    : mode === "refit" ? "Click a built corridor, or drag along several"
    : tool.erase ? "Drag along corridors to fill them in: it costs as much as carving"
    : "Drag along the borders between rooms";
  return (
    <>
      {modes.length > 1 && (mode === "draw" || mode === "refit") && (
        <span className="seg" role="group" aria-label="Corridor tool">
          {modes.map((m) => (
            <button key={m.id} className={mode === m.id ? "on" : ""} title={m.tip} onClick={() => setTool(m.to)} aria-pressed={mode === m.id}>
              {m.name}
            </button>
          ))}
        </span>
      )}
      {mode === "draw" && (
        <span className="tool-group" role="group" aria-label="Finish">
          <span className="dock-label">Finish</span>
          <span className="seg">
            {corridors.finishes.map((f) => {
              const short = Object.entries(f.cost).some(([id, v]) => (resources[id] ?? 0) < v);
              return (
                <button key={f.id} className={`${tool.finish === f.id ? "on" : ""}${short ? " short" : ""}`} title={`${f.name}: ${f.hint}. ${costWords(f.cost)} per 10 m.`} onClick={() => setTool({ ...plain, finish: f.id, erase: false })} aria-pressed={tool.finish === f.id}>
                  <span className="chip" style={{ background: f.color, borderColor: f.accent }} />
                  {f.name}
                </button>
              );
            })}
          </span>
        </span>
      )}
      {mode === "refit" && <WallPicker value={tool.refit!} onPick={(id) => setTool({ ...plain, erase: false, refit: id })} resources={resources} costOf={refitCost} per="per 10 m" />}
      <button className={`toggle erase${tool.erase ? " on" : ""}`} title="Fill corridors in (or take bulkheads and windows out). Or hold Shift while drawing." onClick={() => setTool({ ...noRefit, erase: !tool.erase })} aria-pressed={tool.erase}>
        Erase <kbd>⇧</kbd>
      </button>
      <span className="dock-sep" />
      {!tool.erase && (
        <span className="tool-cost">
          <Amounts amounts={mode === "draw" ? finishDef(tool.finish).cost : mode === "bulkhead" ? corridors.bulkhead.cost : mode === "windows" ? config.windows.costPer10m : refitCost(tool.refit!)} have={resources} />
          <span className="k">{mode === "bulkhead" ? "each" : "per 10 m"}</span>
        </span>
      )}
      <span className="dock-hint">{hint}</span>
    </>
  );
}

/**
 * The tool bar: along the bottom while something is in hand, with only the choices that go with
 * it. A room: its size (a family's members), which way round, what its walls are built in, and
 * what all that comes to. Corridors: what the tool does. Nothing in hand: no bar.
 */
export function ToolBar({ tool, setTool, resources, rotate, highlight, deposits, lining, setLining, reveal = SHOW_ALL }: BarProps) {
  if (!tool) return null;
  const done = (
    <button className="btn ghost done" onClick={() => setTool(null)} title="Put the tool down (Esc, or right-click)">
      Done <kbd>Esc</kbd>
    </button>
  );
  if (tool.kind === "demolish") {
    return (
      <div className="dock-strip tool-bar" role="toolbar" aria-label="Demolish">
        <span className="tool-name danger">
          <Icon id="demolish" size={15} />
          Demolish
        </span>
        <span className="dock-hint">Click a room: half its cost comes back (a blueprint's, all of it)</span>
        {done}
      </div>
    );
  }
  if (tool.kind === "corridor") {
    // Bulkheads and windows are the corridor tool in another mode, but tiles of their own on the rail (#454).
    const name = tool.bulkhead ? corridors.bulkhead.name : tool.windows ? "Windows" : "Corridors";
    return (
      <div className="dock-strip tool-bar" role="toolbar" aria-label={name} style={catColor("circulation")}>
        <span className="tool-name">
          <span className="swatch" />
          {name}
        </span>
        <CorridorBar tool={tool} setTool={setTool} resources={resources} reveal={reveal} />
        {done}
      </div>
    );
  }
  const def = roomDef(tool.room);
  const tile = shownTiles(reveal).find((t) => t.members.some((m) => m.id === def.id));
  const lined = canLineType(def);
  const shapes = shapesFor(def);
  const extra = liningExtra(def, lining, tool.shape);
  const refusal = siteRefusal(def.id, deposits) ?? missingCost(resources, def.id, extra);
  return (
    <div className="dock-strip tool-bar" role="toolbar" aria-label={def.name} style={catColor(def.category)}>
      <span className="tool-name">
        <span className="swatch" />
        {def.name}
      </span>
      {tile && tile.members.length > 1 && (
        <span className="seg" role="group" aria-label="Size">
          {tile.members.map((m) => {
            const why = siteRefusal(m.id, deposits);
            return (
              <button
                key={m.id}
                className={`${m.id === def.id ? "on" : ""}${why ? " short" : ""}${highlight === `room:${m.id}` && m.id !== def.id ? " pulse" : ""}`}
                title={`${m.name}: ${SIZE_NAMES[m.size]?.toLowerCase()}, ${costWords(m.cost) || "free"}${why ? `. ${why}` : ""}`}
                onClick={() => setTool(buildTool(m))}
                aria-pressed={m.id === def.id}
              >
                {variantLabel(tile, m)}
              </button>
            );
          })}
        </span>
      )}
      {def.size !== "surface" && (
        <button className="btn sm" onClick={rotate} disabled={shapes.length < 2} title={shapes.length < 2 ? "This room only goes one way round" : "Turn it the other way round (R)"}>
          <Icon id="rotate" size={13} />
          {tool.shape[0]}×{tool.shape[1]}
          {shapes.length > 1 && <kbd>R</kbd>}
        </button>
      )}
      {lined && reveal.shown("tool:linings") && (
        <WallPicker value={lining} onPick={setLining} resources={resources} costOf={(id) => liningExtra(def, id, tool.shape)} per="on its cost, no extra build time" />
      )}
      <span className="dock-sep" />
      <span className={`tool-cost${refusal ? " short" : ""}`} title={refusal ?? "What it costs, walls and all"}>
        <Amounts amounts={withExtra(def.id, extra)} have={resources} />
      </span>
      {refusal && <span className="dock-hint bad">{refusal}</span>}
      {done}
    </div>
  );
}
