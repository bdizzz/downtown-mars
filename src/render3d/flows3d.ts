import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SimConfig } from "../sim/config";
import { roomSpec, type RoomStatus } from "../sim/economy";
import type { Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { floorSpan, ringRadii, slotAngles, TAU } from "./cylinder";

// Resource flows as pipes: an overlay, switched on from View. Each network
// (power, water, air, food) has a riser in the shaft; every room that makes
// or uses its resource runs a pipe along its ceiling to the shaft wall, then
// round the wall to the riser. Dashes run along the pipes the way the
// resource goes: out of what makes it, into what uses it. Drawn over
// everything, so the whole network reads at once.

export interface FlowNet {
  id: string;
  name: string;
  color: string;
  /** Rooms making any of these feed the network; rooms using any of them draw from it. */
  makes: string[];
  uses: string[];
  /** Homes draw from it too (people breathe the air). */
  homes?: boolean;
}

export const FLOW_NETS: FlowNet[] = [
  { id: "power", name: "Power", color: "#f4d35e", makes: ["power"], uses: ["power"] },
  { id: "water", name: "Water", color: "#4f9fc8", makes: ["water"], uses: ["water"] },
  { id: "air", name: "Air", color: "#a8e6ee", makes: ["o2"], uses: [], homes: true },
  { id: "food", name: "Food", color: "#86ad58", makes: ["rawFood", "meals", "rations"], uses: ["rawFood", "rations"] },
];

const PIPE = {
  radius: 0.09,
  /** How far below the ceiling the pipes run, and the gap between networks. */
  below: 0.35,
  gap: 0.22,
  /** How far in from the shaft face the pipes run round the shaft. */
  inset: 0.25,
  /** Surface rooms: height above the ground, and how far out from the rim they sit (as rooms3d). */
  surfaceY: 0.35,
  surfaceRing: 16,
  /** Dashes: per metre, and how fast they move (metres a second). */
  dashes: 0.8,
  speed: 1.6,
};

/** Where a network's riser stands in the shaft: spread evenly round it. */
function riserAngle(k: number): number {
  return (k / FLOW_NETS.length) * TAU + 0.35;
}

/** A path round the shaft face at a radius and height, from one angle to another, the short way. */
function arc(r: number, y: number, from: number, to: number): THREE.Vector3[] {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const steps = Math.max(1, Math.ceil(Math.abs(d * r) / 1.5));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + (d * i) / steps;
    return new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  });
}

/** A room's pipe end: over its first cell, just under the ceiling (ring rooms), or at the surface. */
function roomEnd(layout: Layout, room: RoomInstance, k: number): { at: THREE.Vector3; angle: number; floor: number } | null {
  const hole = layout.hole;
  if (room.at.kind === "surface") {
    const total = layout.surface.length;
    const angle = ((Math.min(...room.surfaceCells) + room.surfaceCells.length / 2) / total) * TAU;
    const r = hole.shaftRadiusM + PIPE.surfaceRing;
    return { at: new THREE.Vector3(r * Math.cos(angle), PIPE.surfaceY + k * PIPE.gap, r * Math.sin(angle)), angle, floor: 0 };
  }
  const c = [...room.cells].sort((a, b) => a.floor - b.floor || a.ring - b.ring || a.slot - b.slot)[0];
  if (!c) return null;
  const [a0, a1] = slotAngles(c.slot, hole.ringSlots[c.ring - 1]!);
  const [r0, r1] = ringRadii(hole, c.ring);
  const angle = (a0 + a1) / 2;
  const r = (r0 + r1) / 2;
  const y = floorSpan(c.floor)[1] - PIPE.below - k * PIPE.gap;
  return { at: new THREE.Vector3(r * Math.cos(angle), y, r * Math.sin(angle)), angle, floor: c.floor };
}

/** A tube along a polyline, with its distance along the path (metres) and whether its dashes move, per vertex. */
function tube(points: THREE.Vector3[], moving: boolean): THREE.BufferGeometry | null {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < points.length; i++) if (points[i]!.distanceTo(points[i - 1]!) > 1e-3) path.add(new THREE.LineCurve3(points[i - 1]!, points[i]!));
  if (!path.curves.length) return null;
  const length = path.getLength();
  const g = new THREE.TubeGeometry(path, Math.max(2, Math.ceil(length / 0.5)), PIPE.radius, 5, false);
  const uv = g.getAttribute("uv");
  const dist = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) dist[i] = uv.getX(i) * length;
  g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aMove", new THREE.BufferAttribute(new Float32Array(uv.count).fill(moving ? 1 : 0), 1));
  return g;
}

const VERTEX = /* glsl */ `
  attribute float aDist;
  attribute float aMove;
  varying float vDist;
  varying float vMove;
  void main() {
    vDist = aDist;
    vMove = aMove;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float time;
  varying float vDist;
  varying float vMove;
  void main() {
    float dash = smoothstep(0.3, 0.5, fract(vDist * ${PIPE.dashes.toFixed(2)} - time * ${(PIPE.speed * PIPE.dashes).toFixed(2)}));
    float a = mix(0.45, mix(0.35, 0.95, dash), vMove);
    gl_FragColor = vec4(color * mix(0.8, 1.25, dash * vMove), a);
    #include <colorspace_fragment>
  }
`;

export interface FlowRooms {
  /** Rooms feeding and drawing from each network (ids), for tests and the legend. */
  feeds: Record<string, number[]>;
  draws: Record<string, number[]>;
}

/** Which rooms make and use each network's resource: built, running rooms (and homes, for air). */
export function flowRooms(layout: Layout, status: Record<number, RoomStatus>, cfg: SimConfig, topFloor: number | null): FlowRooms {
  const feeds: Record<string, number[]> = {};
  const draws: Record<string, number[]> = {};
  for (const net of FLOW_NETS) {
    feeds[net.id] = [];
    draws[net.id] = [];
  }
  for (const room of layout.rooms) {
    if (room.planned || room.building) continue;
    if (topFloor !== null && room.at.kind === "ring" && Math.min(...room.cells.map((c) => c.floor)) < topFloor) continue;
    if (topFloor !== null && room.at.kind === "surface") continue;
    const spec = roomSpec(room, cfg);
    const running = (status[room.id]?.rate ?? 0) > 0;
    for (const net of FLOW_NETS) {
      const makes = net.makes.some((id) => (spec.makes[id] ?? 0) > 0);
      const uses = net.uses.some((id) => (spec.uses[id] ?? 0) > 0) || (!!net.homes && (roomDef(room.type).houses ?? 0) > 0);
      if (makes && running) feeds[net.id]!.push(room.id);
      else if (uses) draws[net.id]!.push(room.id);
    }
  }
  return { feeds, draws };
}

export class Flows {
  readonly group = new THREE.Group();
  private materials: THREE.ShaderMaterial[] = [];
  private time = { value: 0 };

  constructor() {
    this.group.visible = false;
    this.group.renderOrder = 5;
  }

  /** Rebuild the pipes for these rooms. */
  build(layout: Layout, rooms: FlowRooms): void {
    this.clear();
    const hole = layout.hole;
    const wall = hole.shaftRadiusM - PIPE.inset;
    const byId = new Map(layout.rooms.map((r) => [r.id, r]));
    FLOW_NETS.forEach((net, k) => {
      const parts: THREE.BufferGeometry[] = [];
      const riser = riserAngle(k);
      const ends: number[] = [];
      const spoke = (room: RoomInstance, feeding: boolean) => {
        const end = roomEnd(layout, room, k);
        if (!end) return;
        const at = end.at;
        let pts: THREE.Vector3[];
        if (end.floor === 0) {
          // From the surface: in to the rim, round it, then over the edge and down to the riser's top.
          const rim = hole.shaftRadiusM + 0.4;
          pts = [at, new THREE.Vector3(rim * Math.cos(end.angle), at.y, rim * Math.sin(end.angle)), ...arc(rim, at.y, end.angle, riser), new THREE.Vector3(wall * Math.cos(riser), at.y, wall * Math.sin(riser))];
        } else {
          pts = [at, new THREE.Vector3(wall * Math.cos(end.angle), at.y, wall * Math.sin(end.angle)), ...arc(wall, at.y, end.angle, riser)];
        }
        ends.push(at.y);
        const g = tube(feeding ? pts : pts.reverse(), true);
        if (g) parts.push(g);
      };
      for (const id of rooms.feeds[net.id] ?? []) spoke(byId.get(id)!, true);
      for (const id of rooms.draws[net.id] ?? []) spoke(byId.get(id)!, false);
      if (!parts.length) return;
      // The riser: from the highest pipe to the lowest, still.
      const top = Math.max(...ends);
      const bottom = Math.min(...ends);
      if (top - bottom > 0.05) {
        const g = tube([new THREE.Vector3(wall * Math.cos(riser), top, wall * Math.sin(riser)), new THREE.Vector3(wall * Math.cos(riser), bottom, wall * Math.sin(riser))], false);
        if (g) parts.push(g);
      }
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) return;
      const material = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(net.color) }, time: this.time },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      this.materials.push(material);
      const mesh = new THREE.Mesh(merged, material);
      mesh.renderOrder = 5;
      mesh.userData.net = net.id;
      this.group.add(mesh);
    });
  }

  /** Move the dashes on by dt seconds. */
  step(dt: number): void {
    this.time.value += dt;
  }

  clear(): void {
    for (const o of this.group.children) (o as THREE.Mesh).geometry.dispose();
    this.group.clear();
    this.materials.forEach((m) => m.dispose());
    this.materials = [];
  }

  dispose(): void {
    this.clear();
  }
}
