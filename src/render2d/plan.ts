import { UI_FONT } from "../view/font";
import { crewsAt, crewsKey } from "../view/crews";
import { conditionKey } from "../view/conditionView";
import { reachKey } from "../view/reachView";
import { Application, Container, Graphics, GraphicsContext, Text } from "pixi.js";
import { previewEffects, type EffectField } from "../sim/effects";
import type { Happiness } from "../sim/happiness";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { DrillView } from "../sim/snapshot";
import { floorSpan, pickAt, ringRadii } from "../render3d/cylinder";
import { clickWith, edgeHoverFor, highlightsSlot, hoverInfoFor, hoverKeyFor, paints } from "../view/interaction";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import type { HoverInfo, Pick, Proposal, Stage, StageOptions, Tool, Warning } from "../view/types";
import { drawGlyph, drawPlus } from "./art";
import { constructionStripes, corridorStrip } from "./corridorArt";
import { edgeById, nearestEdge, type Edge } from "../sim/edges";
import { HEAT } from "./palette";
import { BAND, C, FIELD_MAX, PX, RING_D, TAU, cellSector, drawBase, drawField as drawFieldOn, drawRooms, outlineCells, progressLabels as progressAt, roomCentre, stripOf, type ProgressJob } from "./planDraw";

// The plan view: one floor seen from above, drawn flat. The shaft in the
// middle, the gallery ledge around it, then each ring as a band of slots.
// It uses the 3D view's geometry (metres around the shaft's axis), so a slot
// is in the same place and direction as in the 3D top-down camera.

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;
/** How much of the screen's shorter side the unlocked rings fill when fitted. */
const FIT_SHARE = 0.9;
/** Zoom per unit of wheel movement: a pinch (ctrl+wheel), a wheel or trackpad scroll, and a wheel "line" in pixels. */
const WHEEL = { pinch: 0.01, wheel: 0.0015, line: 16, turn: 0.003 };
const CLICK_SLOP = 5;
const LABEL_PX = 12;
const MIN_LABEL_PX = 10;
export async function createPlanStage(host: HTMLElement, opts: StageOptions = {}): Promise<Stage> {
  const app = new Application();
  await app.init({ resizeTo: host, background: C.bg, antialias: true, resolution: window.devicePixelRatio, autoDensity: true });
  host.appendChild(app.canvas);

  const baseCtx = new GraphicsContext();
  const roomsCtx = new GraphicsContext();
  const fieldCtx = new GraphicsContext();
  const overlayCtx = new GraphicsContext();
  const world = new Container();
  let labels = new Container();
  const progressLabels = new Container();
  world.addChild(new Graphics(baseCtx), new Graphics(roomsCtx), new Graphics(fieldCtx), labels, progressLabels, new Graphics(overlayCtx));
  const caption = new Text({ text: "", style: { fontFamily: UI_FONT, fill: C.label, fontSize: 13, fontWeight: "700" } });
  caption.position.set(10, 8);
  app.stage.addChild(world, caption);

  let layout: Layout | null = null;
  let floor = 1;
  let drawnKey = "";
  let gameId = "";
  let drill: DrillView | null = null;
  let resources: Record<string, number> = {};
  let gates: string[] = [];
  let selected: number | null = null;
  /** Build mode is open: bare rock lights up under the pointer, as somewhere to build. */
  let building = false;
  let tool: Tool = null;
  let overlayType: string | null = null;
  let heat = HEAT.normal;
  let field: EffectField | null = null;
  let happiness: Happiness | null = null;
  let fieldKey = "";
  let hoverKey = "";
  let fitted = false;
  /** Until the player pans or zooms, keep the floor fitted to the view as it resizes. */
  let userMoved = false;
  // Always centred on the shaft: the player zooms and turns the layout, but doesn't pan it.
  const cam = { x: 0, y: 0, zoom: 1, rot: 0 };

  // ---- drawing ----

  const onFloor = (cells: Cell[]) => cells.filter((c) => c.floor === floor);

  /** Rooms a maintenance or cleaning crew is at, with its icon, shown on their labels. */
  let crews = new Map<number, string>();
  /** The condition overlay's colours as last drawn. */
  let conditionShown = "";
  function drawField(): void {
    fieldCtx.clear();
    if (!layout) return;
    drawFieldOn(fieldCtx, layout, floor, { overlay: overlayType, field, happiness, heat, selected });
  }

  function drawHalo(type: string, cells: Cell[]): void {
    if (!layout) return;
    const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
    if (!effects.length) return;
    const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
    const grid = previewEffects(layout, type, cells)[main.type]?.[floor - 1];
    if (!grid) return;
    const own = new Set(cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    grid.forEach((slots, ri) =>
      slots.forEach((v, slot) => {
        if (Math.abs(v) < 0.05 || own.has(`${floor}:${ri + 1}:${slot}`)) return;
        overlayCtx.poly(cellSector(layout!.hole, { ring: ri + 1, slot }, 0.15)).fill({ color: v < 0 ? heat.bad : heat.good, alpha: Math.min(1, Math.abs(v) / FIELD_MAX) * 0.6 });
      }),
    );
  }

  function markRoom(room: RoomInstance, color: number): void {
    const cells = onFloor(room.cells);
    if (cells.length) outlineCells(overlayCtx, layout!.hole, cells, color, 3);
  }

  /** A border on this floor highlighted: its strip outlined in a colour, with the finish previewed if given. */
  function ghostEdge(id: string, color: number, finish: string | null, alpha: number): void {
    if (!layout) return;
    const e = edgeById(layout.hole, id);
    if (!e || e.floor !== floor) return;
    const s = stripOf(layout.hole, e);
    const poly = corridorStrip(overlayCtx, s.at, s.normal, s.len, BAND, finish ?? "rock", finish ? 0.7 : 0);
    overlayCtx.poly(poly).fill({ color, alpha }).stroke({ color, width: 2.5 });
  }

  function drawOverlay(info: HoverInfo | null): void {
    overlayCtx.clear();
    if (!layout) return;
    const h = layout.hole;
    const sel = selected !== null ? layout.rooms.find((r) => r.id === selected) : undefined;
    if (sel) markRoom(sel, C.selected);
    // A warning is up: the corridors it would fill in, and whatever they'd cut off, in red.
    if (warning) {
      for (const id of warning.edges) ghostEdge(id, C.bad, null, 0.45);
      for (const id of warning.rooms) {
        const r = layout.rooms.find((x) => x.id === id);
        if (r) markRoom(r, C.bad);
      }
    }
    // A snaked chain (while dragging, or waiting for confirmation): every border on this floor highlighted.
    const shown = snaking ? { edges: chain.edges, erase: chainErase } : proposal;
    if (shown?.edges.length) {
      for (const id of shown.edges) {
        if (shown.erase) ghostEdge(id, C.bad, null, 0.35);
        else if (layout.corridors[id]) ghostEdge(id, C.hover, null, 0.1);
        else ghostEdge(id, C.ok, tool?.kind === "corridor" ? tool.finish : null, 0.15);
      }
      return;
    }
    if (!info) return;
    const p = info.pick;
    if (info.edge) {
      const color = info.edge.refusal || info.edge.erase ? C.bad : C.ok;
      const preview = !info.edge.erase && !info.edge.refusal && tool?.kind === "corridor" && !info.edge.windows ? tool.finish : null;
      // The windows tool lights up the whole wall it would glaze.
      for (const id of info.edge.windows?.edges ?? [info.edge.id]) ghostEdge(id, color, preview, info.edge.erase ? 0.35 : 0.15);
      return;
    }
    if (tool?.kind === "build" && info.check) {
      const color = info.check.ok ? C.ok : C.bad;
      const cells = onFloor(info.check.cells.length ? info.check.cells : p.kind === "slot" ? [p as Cell] : []);
      if (info.check.ok && cells.length) drawHalo(tool.room, cells);
      for (const c of cells) overlayCtx.poly(cellSector(h, c, 0.15)).fill({ color, alpha: 0.35 });
      if (cells.length) outlineCells(overlayCtx, h, cells, color, 3);
      if (info.check.ok && info.check.merges && cells.length) {
        const centre = roomCentre(h, cells);
        drawPlus(overlayCtx, centre.x, centre.y, Math.min(24, centre.size * 0.6), color);
      }
      return;
    }
    if (info.room) {
      if (info.room.id !== selected || tool?.kind === "demolish") markRoom(info.room, tool?.kind === "demolish" ? C.bad : C.hover);
      return;
    }
    if (p.kind === "slot" && highlightsSlot(layout, p, building)) overlayCtx.poly(cellSector(h, p, 0.15)).fill({ color: C.hover, alpha: 0.15 }).stroke({ color: C.hover, width: 2 });
    else if (p.kind === "gallery") {
      overlayCtx.circle(0, 0, h.shaftRadiusM * PX).stroke({ color: C.hover, width: 2 });
    }
  }

  /** "45%" on each room under construction on this floor, as the crews work. */
  let progressKey = "";
  function drawProgress(s: { construction: { jobs: ProgressJob[] } }): void {
    if (!layout) return;
    const key = `${floor}:${layout.version}:` + s.construction.jobs.map((j) => `${j.roomId}:${j.phase}:${Math.floor(j.progress * 100)}`).join(",");
    if (key === progressKey) return;
    progressKey = key;
    progressLabels.removeChildren().forEach((c) => c.destroy());
    for (const p of progressAt(layout, floor, s.construction.jobs)) {
      const t = new Text({ text: p.text, style: { fontFamily: UI_FONT, fill: 0xffffff, fontSize: 14, fontWeight: "800", stroke: { color: 0x1a0f0d, width: 4 } } });
      t.anchor.set(0.5);
      t.position.set(p.x, p.y);
      t.rotation = -cam.rot;
      progressLabels.addChild(t);
    }
  }

  function updateCaption(): void {
    if (!layout) return;
    const dug = drill?.floor === floor ? ` · being dug, ${Math.floor((drill.progress ?? 0) * 100)}%: blueprints only` : "";
    caption.text = `Floor ${floor}${dug}`;
  }

  // ---- camera ----

  /** Fit the unlocked rings on screen, with a little margin: three rings fill it, six sit further out. */
  function fit(): void {
    if (!layout) return;
    const h = layout.hole;
    const outer = ringRadii(h, Math.max(1, Math.min(h.ringSlots.length, h.unlockedRings)))[1] * PX;
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (Math.min(app.screen.width, app.screen.height) * FIT_SHARE) / (outer * 2)));
    cam.x = 0;
    cam.y = 0;
  }

  /** Room names stay readable when zoomed out: never smaller than MIN_LABEL_PX on screen. */
  function nameScale(): number {
    return Math.max(1, MIN_LABEL_PX / (LABEL_PX * cam.zoom));
  }

  function applyCamera(): void {
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
    world.scale.set(cam.zoom);
    world.rotation = cam.rot;
    world.x = app.screen.width / 2;
    world.y = app.screen.height / 2;
    // Names stay upright however the layout is turned.
    for (const marker of labels.children) {
      marker.rotation = -cam.rot;
      marker.getChildByLabel("name")?.scale.set(nameScale());
    }
    for (const label of progressLabels.children) label.rotation = -cam.rot;
    refreshHover();
  }

  // ---- hover and input ----

  const canvas = app.canvas;
  let pointer: { clientX: number; clientY: number } | null = null;
  let drag: { x: number; y: number; moved: number } | null = null;

  function screenToPlan(e: { clientX: number; clientY: number }): [number, number] {
    const r = canvas.getBoundingClientRect();
    // From the screen's centre, unturned and unscaled.
    const sx = (e.clientX - r.left - app.screen.width / 2) / cam.zoom;
    const sy = (e.clientY - r.top - app.screen.height / 2) / cam.zoom;
    const c = Math.cos(cam.rot);
    const sn = Math.sin(cam.rot);
    return [c * sx + sn * sy, -sn * sx + c * sy];
  }

  function pickHere(): Pick {
    if (!layout || !pointer) return { kind: "rock" };
    const [px, py] = screenToPlan(pointer);
    // Mid-height of this floor, in the same metres as the 3D view.
    const [y0, y1] = floorSpan(floor);
    return pickAt(layout.hole, px / PX, (y0 + y1) / 2, py / PX);
  }

  /** Shift erases with the corridor tool. */
  let shift = false;

  /** The border nearest the pointer, on this floor. */
  function edgeHere(): Edge | null {
    if (!layout || !pointer) return null;
    const h = layout.hole;
    const [px, py] = screenToPlan(pointer);
    const r = Math.hypot(px, py) / PX;
    const rings = (r - h.shaftRadiusM) / RING_D;
    return nearestEdge(h, floor, rings, Math.atan2(py, px) / TAU, RING_D);
  }

  function hoverInfo(): HoverInfo | null {
    if (!layout || !pointer) return null;
    if (tool?.kind === "corridor") return edgeHoverFor(layout, resources, tool, pickHere(), edgeHere(), shift);
    return hoverInfoFor(layout, resources, tool, pickHere(), gates);
  }

  function refreshHover(force = false): void {
    const info = hoverInfo();
    const key = hoverKeyFor(info, tool, layout?.version ?? -1, selected) + floor + building;
    const changed = key !== hoverKey;
    if (!force && !changed) return;
    hoverKey = key;
    drawOverlay(info);
    // A forced refresh redraws; the UI only hears about a hover that changed.
    if (changed) opts.onHover?.(info);
  }

  // Snaking corridors: the chain grows and shrinks under the pointer while the button is held.
  let snaking = false;
  let chain: Chain = EMPTY_CHAIN;
  let chainErase = false;
  let proposal: Proposal | null = null;
  let warning: Warning | null = null;

  function snake(): void {
    if (!layout) return;
    const next = extendChain(layout, chain, edgeHere(), chainErase);
    if (next === chain) return;
    chain = next;
    refreshHover(true);
  }

  /** Released: a chain goes to the player to confirm; a single border is just drawn (or filled in). */
  function endSnake(): void {
    snaking = false;
    const done = chain;
    chain = EMPTY_CHAIN;
    if (done.edges.length > 1) opts.onPropose?.({ edges: done.edges, erase: chainErase });
    else if (done.edges.length === 1 && layout) {
      const info = hoverInfo();
      if (info) clickWith(layout, tool, info, opts);
    }
    refreshHover(true);
  }


  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    pointer = e;
    shift = e.shiftKey;
    canvas.setPointerCapture(e.pointerId);
    if (paints(tool) && tool?.kind === "corridor") {
      snaking = true;
      chainErase = shift || tool.erase;
      chain = EMPTY_CHAIN;
      snake();
      return;
    }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    pointer = e;
    shift = e.shiftKey;
    if (snaking) {
      snake();
      return;
    }
    if (drag) {
      // Dragging doesn't pan (the plan stays centred on the shaft); it only tells a click from a slip.
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
    refreshHover();
  };
  const onPointerUp = (e: PointerEvent) => {
    pointer = e;
    if (drag && drag.moved <= CLICK_SLOP && layout) {
      const info = hoverInfo();
      if (info) clickWith(layout, tool, info, opts);
    }
    drag = null;
    if (snaking) endSnake();
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = "";
  };
  const onPointerLeave = () => {
    pointer = null;
    refreshHover();
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    opts.onCancel?.();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    pointer = e;
    userMoved = true;
    const line = e.deltaMode === 1 ? WHEEL.line : 1;
    // Sideways scrolling turns the layout round the shaft, as it turns the 3D views.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
      cam.rot -= e.deltaX * line * WHEEL.turn;
      applyCamera();
      return;
    }
    // The wheel and pinching both zoom, about the shaft. A pinch comes as ctrl+wheel in
    // small steps; a wheel notch is a big step, in lines or pixels.
    const dy = e.deltaY * line;
    cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * Math.exp(-dy * (e.ctrlKey ? WHEEL.pinch : WHEEL.wheel))));
    applyCamera();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Shift" || shift === (e.type === "keydown")) return;
    shift = e.type === "keydown";
    refreshHover(true);
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  app.renderer.on("resize", () => {
    if (!userMoved) fit();
    applyCamera();
  });

  function redraw(force = false): void {
    if (!layout) return;
    const key = `${gameId}:${layout.version}:${JSON.stringify(layout.hole)}:${floor}:${crewsKey(crews)}`;
    if (!force && key === drawnKey) return;
    drawnKey = key;
    baseCtx.clear();
    drawBase(baseCtx, layout.hole, !!layout.domed);
    roomsCtx.clear();
    labels.destroy({ children: true });
    labels = new Container();
    world.addChildAt(labels, 3);
    // The rooms (planDraw.ts, shared with the Godot viewer), each with its icon and name kept upright as the plan turns.
    drawRooms(roomsCtx, layout, floor, {
      stripes: constructionStripes(),
      crews,
      onMarker: (m) => {
        const marker = new Container();
        marker.position.set(m.x, m.y);
        const icon = new Graphics();
        drawGlyph(icon.context, m.room.type, 0, 5, Math.min(26, m.size * 0.55), m.ink);
        marker.addChild(icon);
        if (m.text !== null) {
          const text = new Text({ text: m.text, style: { fontFamily: UI_FONT, fill: m.textColor, fontSize: LABEL_PX, fontWeight: "600" } });
          text.anchor.set(0.5, 1);
          text.position.set(0, -Math.min(10, m.size * 0.25));
          text.label = "name";
          text.scale.set(nameScale());
          marker.addChild(text);
        }
        marker.rotation = -cam.rot;
        labels.addChild(marker);
      },
    });
    fieldKey = "";
    if (!fitted) {
      fit();
      fitted = true;
    }
    applyCamera();
  }

  function redrawField(force = false): void {
    const key = `${overlayType}:${floor}:${heat.bad}:${layout ? reachKey(layout, selected) : ""}`;
    if (!force && key === fieldKey) return;
    fieldKey = key;
    drawField();
  }

  const stage: Stage = {
    update(snapshot) {
      const identity = `${snapshot.gameId}:${snapshot.holeId}`;
      if (identity !== gameId) {
        gameId = identity;
        selected = null;
        fitted = false;
        userMoved = false;
      }
      layout = snapshot.layout;
      crews = crewsAt(snapshot);
      drill = snapshot.drill;
      resources = snapshot.resources;
      gates = snapshot.holeGates;
      const ck = overlayType === "condition" ? conditionKey(snapshot.layout.rooms) : "";
      const fieldChanged = snapshot.effects !== field || (overlayType === "happiness" && snapshot.happiness.pools !== happiness?.pools) || ck !== conditionShown;
      conditionShown = ck;
      field = snapshot.effects;
      happiness = snapshot.happiness;
      redraw();
      drawProgress(snapshot);
      redrawField(fieldChanged);
      updateCaption();
      refreshHover();
    },
    setTool(t) {
      tool = t;
      refreshHover(true);
    },
    setSelected(id) {
      selected = id;
      refreshHover(true);
      redrawField();
    },
    setOverlay(type) {
      overlayType = type;
      redrawField(true);
    },
    setColorBlind(on) {
      heat = on ? HEAT.colorBlind : HEAT.normal;
      redrawField(true);
      refreshHover(true);
    },
    setView3d() {},
    setBuildMode(on) {
      building = on;
      refreshHover(true);
    },
    setGraphics() {
      // Flat drawing: nothing to trade.
    },
    setProposal(p) {
      proposal = p;
      refreshHover(true);
    },
    setWarning(w) {
      warning = w;
      refreshHover(true);
    },
    setFloor(f) {
      const next = f ?? 1;
      if (next === floor) return;
      floor = next;
      redraw(true);
      redrawField(true);
      updateCaption();
      refreshHover(true);
    },
    destroy() {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      app.destroy({ removeView: true }, { children: true, context: true });
    },
  };
  return stage;
}
