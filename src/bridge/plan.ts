import { GraphicsContext } from "pixi.js";
import { drawGlyph } from "../render2d/art";
import { drawBase, drawField, drawRooms, progressLabels, PX } from "../render2d/planDraw";
import { HEAT } from "../render2d/palette";
import { queueView } from "../sim/construction";
import { config } from "../sim/config";
import { canDig, diggingFloor, ticksToDig } from "../sim/digging";
import { conditionKey } from "../view/conditionView";
import { reachKey } from "../view/reachView";
import type { SimState } from "../sim/state";
import { crewsAt } from "../view/crews";
import { maintenanceView } from "../sim/condition";

// The plan view for the Godot viewer: the web's own drawing (render2d/planDraw.ts) run here onto Pixi
// GraphicsContexts, which record what's drawn; their instructions go to Godot, which paints them. So
// the two plans are the same, down to the corridors' finishes and the rooms' icons.

/** One drawing operation: fill or stroke, colour, alpha, width, and its shapes ([kind, ...numbers]). */
type Op = { f: 0 | 1; c: string; a: number; w: number; s: (string | number)[][]; stripes?: true };

/** Rooms under construction are hatched: Pixi wants a texture for that, so a fill in this colour stands for it. */
const STRIPES = { color: 0xe0a03b, alpha: 0.5 };

const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A context's instructions as ops. */
function record(g: GraphicsContext): Op[] {
  const ops: Op[] = [];
  for (const ins of g.instructions) {
    if (ins.action !== "fill" && ins.action !== "stroke") continue;
    const data = ins.data as unknown as { style: { color: number; alpha: number; width?: number }; path: { shapePath: { shapePrimitives: { shape: Record<string, unknown> & { type: string }; transform?: unknown }[] } } };
    const style = data.style;
    const shapes: (string | number)[][] = [];
    for (const { shape } of data.path.shapePath.shapePrimitives) {
      switch (shape.type) {
        case "polygon": {
          const pts = (shape.points as number[]).map(r2);
          shapes.push([shape.closePath ? "P" : "L", ...pts]);
          break;
        }
        case "circle":
          shapes.push(["C", r2(shape.x as number), r2(shape.y as number), r2(shape.radius as number)]);
          break;
        case "ellipse":
          shapes.push(["E", r2(shape.x as number), r2(shape.y as number), r2(shape.halfWidth as number), r2(shape.halfHeight as number)]);
          break;
        case "rectangle":
        case "roundedRectangle":
          shapes.push(["R", r2(shape.x as number), r2(shape.y as number), r2(shape.width as number), r2(shape.height as number)]);
          break;
      }
    }
    if (!shapes.length) continue;
    const stripes = ins.action === "fill" && style.color === STRIPES.color && Math.abs(style.alpha - STRIPES.alpha) < 1e-3;
    ops.push({ f: ins.action === "fill" ? 1 : 0, c: hex(style.color), a: r2(style.alpha), w: r2(style.width ?? 1), s: shapes, ...(stripes ? { stripes: true as const } : {}) });
  }
  return ops;
}

export interface PlanMessage {
  type: "plan";
  holeId: number;
  floor: number;
  /** Pixels per metre in the ops (world x, z = plan x, y over this). */
  px: number;
  /** How far out the unlocked rings reach, metres: what's fitted to the screen. */
  outer: number;
  ops: Op[];
  markers: { x: number; y: number; text: string | null; textColor: string; glyph: Op[] }[];
}

/** What decides the plan: the hole, its layout, the floor, room colours, and the crews at work. */
export function planKey(state: SimState, floor: number, roomColors: boolean): string {
  const crews = crewsAt({ maintenance: maintenanceView(state) });
  return `${state.holeId}:${state.layout.version}:${floor}:${roomColors}:${[...crews].join(",")}`;
}

export function planMessage(state: SimState, floor: number, roomColors: boolean): PlanMessage {
  const l = state.layout;
  const g = new GraphicsContext();
  drawBase(g, l.hole, !!l.domed);
  const markers: PlanMessage["markers"] = [];
  drawRooms(g, l, floor, {
    stripes: STRIPES,
    crews: crewsAt({ maintenance: maintenanceView(state) }),
    roomColors,
    onMarker: (m) => {
      const icon = new GraphicsContext();
      drawGlyph(icon, m.room.type, 0, 5, Math.min(26, m.size * 0.55), m.ink);
      markers.push({ x: r2(m.x), y: r2(m.y), text: m.text, textColor: hex(m.textColor), glyph: record(icon) });
      icon.destroy();
    },
  });
  const ops = record(g);
  g.destroy();
  return { type: "plan", holeId: state.holeId, floor, px: PX, outer: l.hole.shaftRadiusM + l.hole.unlockedRings * 10, ops, markers };
}

/** Over the plan, as the web's: the overlay's tints (or a selected service's reach), and each room under construction's progress. */
export interface PlanFieldMessage {
  type: "planField";
  holeId: number;
  floor: number;
  ops: Op[];
  progress: { x: number; y: number; text: string }[];
  /** "being dug, 40%: blueprints only" while the drill is on this floor, else null. */
  dug: string | null;
}

export interface FieldView {
  overlay: string | null;
  selected: number | null;
  colorBlind: boolean;
}

/** How far the drill is through this floor (0..1), or null when it isn't digging it. */
function dugShare(state: SimState, floor: number): number | null {
  const at = canDig(state, config) ? diggingFloor(state) : null;
  return at === floor ? state.drill.progress / ticksToDig(floor, config) : null;
}

/** What decides the overlay and progress: everything the web's plan redraws them for. */
export function planFieldKey(state: SimState, floor: number, v: FieldView, effectsVersion: number): string {
  const l = state.layout;
  const happy = v.overlay === "happiness" ? state.happiness.pools.map((p) => Math.round(p.happiness)).join(",") : "";
  const cond = v.overlay === "condition" ? conditionKey(l.rooms) : "";
  const jobs = queueView(state).jobs.map((j) => `${j.roomId}:${j.phase}:${Math.floor(j.progress * 100)}`).join(",");
  const drill = Math.floor((dugShare(state, floor) ?? -0.01) * 100);
  return `${state.holeId}:${floor}:${l.version}:${v.overlay}:${v.colorBlind}:${reachKey(l, v.selected)}:${effectsVersion}:${happy}:${cond}:${jobs}:${drill}`;
}

export function planFieldMessage(state: SimState, floor: number, v: FieldView): PlanFieldMessage {
  const g = new GraphicsContext();
  drawField(g, state.layout, floor, { overlay: v.overlay, field: state.effects.field, happiness: state.happiness, heat: v.colorBlind ? HEAT.colorBlind : HEAT.normal, selected: v.selected });
  const ops = record(g);
  g.destroy();
  const progress = progressLabels(state.layout, floor, queueView(state).jobs).map((p) => ({ x: r2(p.x), y: r2(p.y), text: p.text }));
  const share = dugShare(state, floor);
  const dug = share !== null ? `being dug, ${Math.floor(share * 100)}%: blueprints only` : null;
  return { type: "planField", holeId: state.holeId, floor, ops, progress, dug };
}
