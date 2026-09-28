import * as THREE from "three";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import { CATEGORY_COLORS } from "../render2d/palette";
import { floorSpan, ringRadii, slotAngles, TAU } from "./cylinder";
import { cellEdges, edgeById, outsideEdges, type ArcEdge, type Edge } from "../sim/edges";
import { corridors, finishDef } from "../sim/corridors";

// Rooms as solid wedges carved into the rock, plus the shaft wall wherever
// no room faces it, plus props on the surface. Rebuilt whenever the layout
// changes; everything here is plain geometry, no per-frame work.

const ARC_STEPS = 4;
const ROOF_GAP = 0.3;
const INSET = 0.06;
const WINDOW = { bottom: 1.4, top: 3.0, inset: 0.03, color: 0x2d4f6e };
const DOOR = { width: 1.3, height: 2.3, color: 0x2a1a14 };
const SURFACE_RING_M = 16; // how far from the rim surface props stand
const LABEL = { px: 40, heightM: 1.1 };
const GLOW = { windowBoost: 5 };

export interface RoomColors {
  rock: number;
  stranded: number;
}

/** How faint the shaft wall and ring-1 rooms get in x-ray, so deeper rings show. */
const XRAY = { wall: 0.1, ring1: 0.28 };

/** Vertices for a curved face at radius r, or a flat radial side, as triangles. */
function push(pos: number[], ...pts: number[][]): void {
  for (const p of pts) pos.push(p[0]!, p[1]!, p[2]!);
}
const at = (r: number, a: number, y: number) => [r * Math.cos(a), y, r * Math.sin(a)];

function curvedFace(pos: number[], r: number, a0: number, a1: number, y0: number, y1: number): void {
  for (let i = 0; i < ARC_STEPS; i++) {
    const b0 = a0 + ((a1 - a0) * i) / ARC_STEPS;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / ARC_STEPS;
    push(pos, at(r, b0, y0), at(r, b1, y0), at(r, b1, y1), at(r, b0, y0), at(r, b1, y1), at(r, b0, y1));
  }
}

function flatRing(pos: number[], r0: number, r1: number, a0: number, a1: number, y: number): void {
  for (let i = 0; i < ARC_STEPS; i++) {
    const b0 = a0 + ((a1 - a0) * i) / ARC_STEPS;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / ARC_STEPS;
    push(pos, at(r0, b0, y), at(r1, b0, y), at(r1, b1, y), at(r0, b0, y), at(r1, b1, y), at(r0, b1, y));
  }
}

function radialSide(pos: number[], r0: number, r1: number, a: number, y0: number, y1: number): void {
  push(pos, at(r0, a, y0), at(r1, a, y0), at(r1, a, y1), at(r0, a, y0), at(r1, a, y1), at(r0, a, y1));
}

function geometry(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** One piece of a cell between corridor changes: its angles, and its inner and outer radius after carving. */
interface Piece {
  b0: number;
  b1: number;
  rr0: number;
  rr1: number;
  innerHall: boolean;
  outerHall: boolean;
}

/**
 * How a cell is carved by the corridors along it. Sides facing another cell
 * of the same group (`own`) aren't sides at all; outside sides are pulled
 * back by `inset`, or by half a corridor where one runs. The inner and outer
 * sides may be cut into pieces (outer rings have more slots), each with or
 * without a corridor, so the cell is split where that changes. Without
 * `carve`, corridors are ignored. `openInner` leaves the inner side where it
 * is (a public room onto the gallery).
 */
function carveCell(
  layout: Layout,
  c: Cell,
  own: Set<string>,
  inner: number,
  outer: number,
  inset: number,
  carve: boolean,
  openInner = false,
): { a0: number; a1: number; pieces: Piece[]; openLeft: boolean; openRight: boolean; hallLeft: boolean; hallRight: boolean } {
  const hole = layout.hole;
  const key = (x: Cell) => `${x.floor}:${x.ring}:${x.slot}`;
  const hall = (id: string) => carve && !!layout.corridors?.[id];
  const n = hole.ringSlots[c.ring - 1]!;
  const [s0, s1] = slotAngles(c.slot, n);
  const [r0, r1] = ringRadii(hole, c.ring);
  const rMid = (r0 + r1) / 2;
  const hallLeft = hall(`R${c.floor}.${c.ring}.${c.slot}`);
  const hallRight = hall(`R${c.floor}.${c.ring}.${(c.slot + 1) % n}`);
  const openLeft = !own.has(key({ ...c, slot: (c.slot - 1 + n) % n }));
  const openRight = !own.has(key({ ...c, slot: (c.slot + 1) % n }));
  const a0 = s0 + (openLeft ? (hallLeft ? HALL : inset) / rMid : 0);
  const a1 = s1 - (openRight ? (hallRight ? HALL : inset) / rMid : 0);
  const arcs = cellEdges(hole, c).filter((e): e is ArcEdge => e.kind === "arc");
  const sides = (circle: number) => arcs.filter((e) => e.circle === circle).map((e) => ({ b0: e.a0 * TAU, b1: e.a1 * TAU, hall: hall(e.id) }));
  const innerSides = c.ring > 1 ? sides(c.ring - 1) : [];
  const outerSides = sides(c.ring);
  // Only split where a corridor starts or stops; an uncarved side stays one piece.
  const carved = [...innerSides, ...outerSides].some((p) => p.hall);
  const cutAt = carved ? [...innerSides, ...outerSides].flatMap((p) => [p.b0, p.b1]) : [];
  const cuts = [...new Set([a0, a1, ...cutAt].filter((b) => b >= a0 && b <= a1))].sort((x, y) => x - y);
  const hallAt = (list: { b0: number; b1: number; hall: boolean }[], b: number) => list.some((p) => b >= p.b0 - 1e-9 && b < p.b1 - 1e-9 && p.hall);
  const pieces: Piece[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const b0 = cuts[k]!;
    const b1 = cuts[k + 1]!;
    if (b1 - b0 < 1e-9) continue;
    const mid = (b0 + b1) / 2;
    const innerHall = hallAt(innerSides, mid);
    const outerHall = hallAt(outerSides, mid);
    const rr0 = r0 + (c.ring === inner && !openInner ? (innerHall ? HALL : inset) : 0);
    const rr1 = r1 - (c.ring === outer ? (outerHall ? HALL : inset) : 0);
    pieces.push({ b0, b1, rr0, rr1, innerHall, outerHall });
  }
  return { a0, a1, pieces, openLeft, openRight, hallLeft, hallRight };
}

/**
 * One room: a floor and walls for every cell, without the faces its own cells
 * share, and no ceiling, so you can always see in. It's inset a few
 * centimetres on every outside face, so two rooms that touch never share a
 * plane (which would flicker) and a hairline of rock shows between them.
 * Where a corridor runs along an outside edge, the room gives up half the
 * corridor's width on that side instead, even along part of a side, so
 * corridors look carved out of the rooms they pass. A public room has no wall
 * where it opens onto the gallery or a corridor. With `carve` off (overlay
 * tints), corridors are ignored.
 */
export function roomGeometry(layout: Layout, cells: Cell[], inset = INSET, carve = true, publicRoom = false): THREE.BufferGeometry {
  const key = (c: Cell) => `${c.floor}:${c.ring}:${c.slot}`;
  const own = new Set(cells.map(key));
  const rings = cells.map((c) => c.ring);
  const inner = Math.min(...rings);
  const outer = Math.max(...rings);
  const pos: number[] = [];
  for (const c of cells) {
    let [y0, y1] = floorSpan(c.floor);
    y0 += inset;
    // Floor-1 walls stop just under the ground, so the two surfaces don't fight.
    y1 -= c.floor === 1 ? Math.max(inset, ROOF_GAP) : inset;
    // A public room on the gallery has no wall there: it runs right up to the shaft.
    const onGallery = publicRoom && c.ring === 1;
    const cut = carveCell(layout, c, own, inner, outer, inset, carve, onGallery);
    let prev: Piece | null = null;
    for (const p of cut.pieces) {
      // Walls, except where a public room opens onto the gallery or a corridor.
      if (c.ring === inner && !onGallery && !(publicRoom && p.innerHall)) curvedFace(pos, p.rr0, p.b0, p.b1, y0, y1);
      if (c.ring === outer && !(publicRoom && p.outerHall)) curvedFace(pos, p.rr1, p.b0, p.b1, y0, y1);
      flatRing(pos, p.rr0, p.rr1, p.b0, p.b1, y0);
      // A step where a corridor starts or stops partway along a side.
      if (prev) {
        if (prev.rr0 !== p.rr0) radialSide(pos, Math.min(prev.rr0, p.rr0), Math.max(prev.rr0, p.rr0), p.b0, y0, y1);
        if (prev.rr1 !== p.rr1) radialSide(pos, Math.min(prev.rr1, p.rr1), Math.max(prev.rr1, p.rr1), p.b0, y0, y1);
      }
      prev = p;
    }
    const first = cut.pieces[0];
    const last = cut.pieces.at(-1);
    if (cut.openLeft && first && !(publicRoom && cut.hallLeft)) radialSide(pos, first.rr0, first.rr1, cut.a0, y0, y1);
    if (cut.openRight && last && !(publicRoom && cut.hallRight)) radialSide(pos, last.rr0, last.rr1, cut.a1, y0, y1);
  }
  return geometry(pos);
}

/** Half a corridor's width: what a room gives up on a side a corridor runs along. */
const HALL = corridors.widthM / 2;

/**
 * Ring-1 cells: the face the shaft sees, for windows and doors. It ends where
 * the room's side walls stand, so a corridor carved along a side pulls the
 * windows back with it (the same angles `roomGeometry` uses).
 */
export function shaftFaces(layout: Layout, room: RoomInstance): { a0: number; a1: number; y0: number; r: number }[] {
  const hole = layout.hole;
  const n = hole.ringSlots[0]!;
  const [r0, r1] = ringRadii(hole, 1);
  const rMid = (r0 + r1) / 2;
  const own = new Set(room.cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
  const pullBack = (c: Cell, slot: number, edge: number) => {
    if (own.has(`${c.floor}:1:${(slot + n) % n}`)) return 0; // the room carries on: no wall here
    return (layout.corridors?.[`R${c.floor}.1.${edge % n}`] ? HALL : INSET) / rMid;
  };
  return room.cells
    .filter((c) => c.ring === 1)
    .map((c) => {
      const [s0, s1] = slotAngles(c.slot, n);
      const a0 = s0 + pullBack(c, c.slot - 1, c.slot);
      const a1 = s1 - pullBack(c, c.slot + 1, c.slot + 1);
      return { a0, a1, y0: floorSpan(c.floor)[0], r: r0 };
    });
}

const materialCache = new Map<string, THREE.Material>();
function material(key: string, make: () => THREE.Material): THREE.Material {
  let m = materialCache.get(key);
  if (!m) materialCache.set(key, (m = make()));
  return m;
}

/** Windows glow brighter as the sky darkens: 0 at noon, 1 at night. */
export function setNightGlow(night: number): void {
  const glass = materialCache.get("glass") as THREE.MeshStandardMaterial | undefined;
  if (glass) glass.emissiveIntensity = 1 + night * GLOW.windowBoost;
}

export function disposeRoomMaterials(): void {
  materialCache.forEach((m) => m.dispose());
  materialCache.clear();
  labelCache.forEach(({ material }) => {
    material.map?.dispose();
    material.dispose();
  });
  labelCache.clear();
  shapeCache.forEach(({ geo, edges }) => {
    geo.dispose();
    edges.dispose();
  });
  shapeCache.clear();
}

function roomMaterial(color: number, planned: boolean, faint = false): THREE.Material {
  return material(`room:${color}:${planned}:${faint}`, () =>
    planned || faint
      ? new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: planned ? 0.3 : XRAY.ring1,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide }),
  );
}

/** Label materials are shared by text: a colony has hundreds of rooms but few distinct names. */
const labelCache = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();

/** A name floating in front of the room, readable from across the shaft. */
function label(text: string, color: string): THREE.Sprite {
  const key = `${text}|${color}`;
  let cached = labelCache.get(key);
  if (!cached) {
    cached = drawLabel(text, color);
    labelCache.set(key, cached);
  }
  const sprite = new THREE.Sprite(cached.material);
  sprite.scale.set(LABEL.heightM * cached.aspect, LABEL.heightM, 1);
  return sprite;
}

function drawLabel(text: string, color: string): { material: THREE.SpriteMaterial; aspect: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${LABEL.px}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = LABEL.px + 20;
  ctx.font = `600 ${LABEL.px}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(20, 10, 8, 0.72)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, canvas.height, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { material: new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }), aspect: w / canvas.height };
}

/**
 * Room solids and outlines, kept between rebuilds: most layout changes touch
 * one room, so the other few hundred reuse what they had. Entries not used by
 * the latest build are freed.
 */
const shapeCache = new Map<string, { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>();

function roomShape(layout: Layout, room: RoomInstance): { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry; key: string } {
  // Corridors along its sides change its shape, so they're part of the key.
  const halls = outsideEdges(layout.hole, room.cells)
    .filter((e) => layout.corridors?.[e.id])
    .map((e) => e.id)
    .join(",");
  const key = `${room.id}:${layout.hole.shaftRadiusM}:${room.cells.map((c) => `${c.floor}.${c.ring}.${c.slot}`).join(",")}:${halls}`;
  let shape = shapeCache.get(key);
  if (!shape) {
    const geo = roomGeometry(layout, room.cells, INSET, true, !!roomDef(room.type).public);
    shape = { geo, edges: new THREE.EdgesGeometry(geo, 30) };
    shapeCache.set(key, shape);
  }
  return { ...shape, key };
}

// ---- surface props, standing on y = 0 around the rim ----

function surfaceProp(room: RoomInstance, layout: Layout, color: number): THREE.Object3D {
  const total = layout.surface.length;
  const span = (room.surfaceCells.length / total) * TAU;
  const start = (Math.min(...room.surfaceCells) / total) * TAU;
  const mid = start + span / 2;
  const r = layout.hole.shaftRadiusM + SURFACE_RING_M;
  const g = new THREE.Group();
  g.position.set(r * Math.cos(mid), 0, r * Math.sin(mid));
  g.rotation.y = -mid;
  const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    material(`prop:${c}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra }));

  if (room.type === "landing_pod") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 12, 0, TAU, 0, Math.PI / 2), mat(color));
    g.add(dome);
    for (const dz of [-2.5, 0, 2.5]) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), mat(0x9fd2ff, { emissive: 0x3a6f99 }));
      win.position.set(-4.6, 3.2, dz);
      win.rotation.y = -Math.PI / 2;
      g.add(win);
    }
  } else if (room.type === "landing_pad") {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.5, 32), mat(color)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.15, 6, 48), mat(0xf0e0d0, { emissive: 0x554433 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    g.add(ring);
  } else if (room.type === "solar_array") {
    for (const dz of [-3, 0, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6), mat(0x555555));
      post.position.set(0, 0.8, dz);
      g.add(post);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.4), mat(0x1d2a4a, { metalness: 0.5, roughness: 0.3 }));
      panel.position.set(0, 1.7, dz);
      panel.rotation.z = 0.5;
      g.add(panel);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 2.5), mat(color));
      frame.position.copy(panel.position).setY(1.62);
      frame.rotation.z = 0.5;
      g.add(frame);
    }
  } else if (room.type === "rover_depot") {
    const garage = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 6), mat(color));
    garage.position.set(0, 1.3, -4);
    g.add(garage);
    for (const dz of [2, 6]) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 3.2), mat(0xd8c8b0));
      body.position.set(0, 0.9, dz);
      g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.2), mat(0x9fd2ff, { emissive: 0x2a4a66 }));
      cab.position.set(0, 1.6, dz + 0.8);
      g.add(cab);
      for (const [wx, wz] of [[-1.1, -1], [1.1, -1], [-1.1, 1], [1.1, 1]] as const) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), mat(0x2a2220));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.45, dz + wz);
        g.add(wheel);
      }
    }
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), mat(color)));
  }
  return g;
}

/**
 * Everything that depends on the layout: rooms, the shaft wall where no room
 * faces it, and surface props. digFloor is the floor being dug, if any.
 */
/**
 * Everything that depends on the layout. With `topFloor`, nothing above that
 * floor is built (shallower floors and surface props), and the floor's empty
 * cells get a rock cap, so from above it reads as a plan and its empty cells
 * can be picked.
 */
export function buildLayout(layout: Layout, digFloor: number | null, colors: RoomColors, xray = false, topFloor: number | null = null): THREE.Group {
  const group = new THREE.Group();
  const hole = layout.hole;
  const n1 = hole.ringSlots[0]!;
  const rock = material(`rock:${colors.rock}:${xray}`, () =>
    xray
      ? new THREE.MeshStandardMaterial({ color: colors.rock, transparent: true, opacity: XRAY.wall, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: colors.rock, roughness: 0.95, side: THREE.DoubleSide }),
  );

  // The shaft wall, wherever a built room doesn't replace it.
  const lastFloor = digFloor ?? hole.floors;
  const wall: number[] = [];
  for (let floor = topFloor ?? 1; floor <= lastFloor; floor++) {
    const [y0, y1] = floorSpan(floor);
    for (let slot = 0; slot < n1; slot++) {
      const id = layout.grid[floor - 1]?.[0]?.[slot];
      const room = id ? layout.rooms.find((r) => r.id === id) : undefined;
      if (room && !room.planned) continue;
      // A corridor's mouth: the wall stops half a corridor short of the spoke on either side.
      const [s0, s1] = slotAngles(slot, n1);
      const mouth = (i: number) => (layout.corridors?.[`R${floor}.1.${i % n1}`] ? HALL / hole.shaftRadiusM : 0);
      const a0 = s0 + mouth(slot);
      const a1 = s1 - mouth(slot + 1);
      if (a1 > a0) curvedFace(wall, hole.shaftRadiusM, a0, a1, y0, y1);
    }
  }
  const wallMesh = new THREE.Mesh(geometry(wall), rock);
  wallMesh.userData = { pickable: true, wall: true, faint: xray };
  group.add(wallMesh);

  const used = new Set<string>();
  const glass = material("glass", () => new THREE.MeshStandardMaterial({ color: WINDOW.color, emissive: 0x2a3f55, roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide }));
  const door = material("door", () => new THREE.MeshStandardMaterial({ color: DOOR.color, roughness: 0.9, side: THREE.DoubleSide }));
  const strandedLine = material(`stranded:${colors.stranded}`, () => new THREE.LineBasicMaterial({ color: colors.stranded })) as THREE.LineBasicMaterial;
  const edgeLine = material("edges", () => new THREE.LineBasicMaterial({ color: 0x1a0f0d, transparent: true, opacity: 0.5 })) as THREE.LineBasicMaterial;

  if (topFloor !== null) group.add(...floorCap(layout, topFloor));
  group.add(...corridorFloors(layout, topFloor));

  for (const whole of layout.rooms) {
    // Above the chosen floor there's nothing; tall rooms keep only the part at or below it.
    const room = topFloor === null ? whole : { ...whole, cells: whole.cells.filter((c) => c.floor >= topFloor) };
    if (topFloor !== null && (room.at.kind === "surface" || !room.cells.length)) continue;
    const def = roomDef(room.type);
    const color = CATEGORY_COLORS[def.category] ?? 0x888888;
    if (room.at.kind === "surface") {
      const prop = surfaceProp(room, layout, color);
      prop.traverse((o) => (o.userData = { pickable: true, roomId: room.id, surface: true }));
      group.add(prop);
      continue;
    }
    const shape = roomShape(layout, room);
    used.add(shape.key);
    const faint = xray && room.cells.some((c) => c.ring === 1);
    const mesh = new THREE.Mesh(shape.geo, roomMaterial(color, room.planned || !!room.building, faint));
    mesh.userData = { pickable: true, roomId: room.id, faint, cached: true };
    group.add(mesh);
    const edges = new THREE.LineSegments(shape.edges, room.connected ? edgeLine : strandedLine);
    edges.userData = { cached: true };
    group.add(edges);

    if (!room.planned && !faint && !def.public) {
      // Shaft frontage: a window band on every ring-1 face, a door in the middle of the room's run.
      const faces = shaftFaces(layout, room);
      const win: number[] = [];
      for (const f of faces) curvedFace(win, f.r - WINDOW.inset, f.a0 + 0.02, f.a1 - 0.02, f.y0 + WINDOW.bottom, f.y0 + WINDOW.top);
      if (win.length) group.add(new THREE.Mesh(geometry(win), glass));
      const mid = faces[Math.floor(faces.length / 2)];
      if (mid) {
        const a = (mid.a0 + mid.a1) / 2;
        const half = DOOR.width / 2 / mid.r;
        const d: number[] = [];
        curvedFace(d, mid.r - WINDOW.inset * 2, a - half, a + half, mid.y0 + 0.4, mid.y0 + 0.4 + DOOR.height);
        group.add(new THREE.Mesh(geometry(d), door));
      }
    }

    if (def.short) {
      const first = [...room.cells].sort((a, b) => a.ring - b.ring || a.slot - b.slot)[0]!;
      const n = hole.ringSlots[first.ring - 1]!;
      const [a0, a1] = slotAngles(first.slot, n);
      const [r0] = ringRadii(hole, first.ring);
      const y1 = floorSpan(first.floor)[1];
      const sprite = label(room.connected ? def.short : `${def.short} ⚠`, room.planned ? "#d8c0ae" : "#f6efe6");
      const a = (a0 + a1) / 2;
      sprite.position.set((r0 - 0.6) * Math.cos(a), y1 - 0.8, (r0 - 0.6) * Math.sin(a));
      sprite.userData = { label: true, cached: true };
      group.add(sprite);
    }
  }
  for (const [key, shape] of shapeCache) {
    if (used.has(key)) continue;
    shape.geo.dispose();
    shape.edges.dispose();
    shapeCache.delete(key);
  }
  return group;
}

/** How each finish looks in 3D: its colour, and a surface to match. */
const FINISH_LOOK: Record<string, THREE.MeshStandardMaterialParameters> = {
  rock: { roughness: 1 },
  marscrete: { roughness: 0.85 },
  brick: { roughness: 0.9 },
  metal: { roughness: 0.35, metalness: 0.6 },
};
const UNLINKED = 0xe0503a;

/** A corridor's floor: a strip centred on its border, `lift` above the floor (or on the cut, from above). */
export function corridorStripGeometry(layout: Layout, e: Edge, y: number): THREE.BufferGeometry {
  const hole = layout.hole;
  const pos: number[] = [];
  if (e.kind === "radial") {
    const a = e.turn * TAU;
    const [r0, r1] = ringRadii(hole, e.ring);
    // A flat rectangle along the spoke, HALL either side of it.
    const px = -Math.sin(a) * HALL;
    const pz = Math.cos(a) * HALL;
    const p = (r: number, s: number) => [r * Math.cos(a) + px * s, y, r * Math.sin(a) + pz * s];
    push(pos, p(r0, -1), p(r1, -1), p(r1, 1), p(r0, -1), p(r1, 1), p(r0, 1));
  } else {
    const r = ringRadii(hole, e.circle)[1];
    flatRing(pos, r - HALL, r + HALL, e.a0 * TAU, e.a1 * TAU, y);
  }
  return geometry(pos);
}

/**
 * Every corridor's floor, one mesh per finish (and one for corridors not yet
 * linked to the shaft, tinted red). Just above the floor; with a floor chosen
 * from above, on the cut instead, so they show over the cap.
 */
function corridorFloors(layout: Layout, topFloor: number | null): THREE.Object3D[] {
  const hole = layout.hole;
  const groups = new Map<string, number[]>();
  for (const [id, finish] of Object.entries(layout.corridors ?? {})) {
    const e = edgeById(hole, id);
    if (!e || e.floor > hole.floors + 1) continue;
    if (topFloor !== null && e.floor < topFloor) continue;
    // Corridors have no ceiling: always on the floor, open to the sky or the cut above.
    const y = floorSpan(e.floor)[0] + 0.05;
    const linked = !!layout.corridorLinked?.[id] || e.floor > hole.floors;
    // Not built yet: see-through, like a blueprint.
    const building = layout.corridorsBuilding?.[id] !== undefined;
    const key = `${finish}:${linked || building}:${building}`;
    const geo = corridorStripGeometry(layout, e, y);
    const arr = geo.getAttribute("position").array as Float32Array;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(...arr);
    geo.dispose();
  }
  const out: THREE.Object3D[] = [];
  for (const [key, pos] of groups) {
    const [finish, linked, building] = key.split(":");
    const f = finishDef(finish!);
    const color = linked === "true" ? parseInt(f.color.slice(1), 16) : UNLINKED;
    const see = building === "true" ? { transparent: true, opacity: 0.35, depthWrite: false } : {};
    const mat = material(`hall:${key}`, () => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, ...FINISH_LOOK[finish!], ...see }));
    const mesh = new THREE.Mesh(geometry(pos), mat);
    mesh.userData = { pickable: true, hall: true };
    out.push(mesh);
  }
  return out;
}

const CAP = { rock: 0x4a2a1e, locked: 0x33201a, beyond: 0x241410, lift: 0.02, beyondM: 30 };

/**
 * A rock lid over the chosen floor's empty cells, just under its ceiling:
 * carved cells in rock, locked rings darker, and solid rock past the last
 * ring. Carved and locked cells are pickable, so they can be built on from above.
 */
function floorCap(layout: Layout, floor: number): THREE.Object3D[] {
  const hole = layout.hole;
  const [y0, y1] = floorSpan(floor);
  const y = y1 - CAP.lift;
  const open: number[] = [];
  const locked: number[] = [];
  // Rock where a corridor has been carved into it: walls from the cap down to the corridor floor.
  const cutWalls: number[] = [];
  hole.ringSlots.forEach((n, ri) => {
    const ring = ri + 1;
    for (let slot = 0; slot < n; slot++) {
      const id = layout.grid[floor - 1]?.[ri]?.[slot];
      if (id) continue;
      // The cap has no lid over corridors: it's carved like a room, by half a corridor on each side one runs.
      const c = { floor, ring, slot };
      const cut = carveCell(layout, c, new Set([`${floor}:${ring}:${slot}`]), ring, ring, 0, true);
      for (const p of cut.pieces) {
        flatRing(ring > hole.unlockedRings ? locked : open, p.rr0, p.rr1, p.b0, p.b1, y);
        if (p.innerHall) curvedFace(cutWalls, p.rr0, p.b0, p.b1, y0, y);
        if (p.outerHall) curvedFace(cutWalls, p.rr1, p.b0, p.b1, y0, y);
      }
      const first = cut.pieces[0];
      const last = cut.pieces.at(-1);
      if (cut.hallLeft && first) radialSide(cutWalls, first.rr0, first.rr1, cut.a0, y0, y);
      if (cut.hallRight && last) radialSide(cutWalls, last.rr0, last.rr1, cut.a1, y0, y);
    }
  });
  const outer = ringRadii(hole, hole.ringSlots.length)[1];
  const beyond: number[] = [];
  flatRing(beyond, outer, outer + CAP.beyondM, 0, TAU, y);
  const mat = (c: number) => material(`cap:${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
  const openMesh = new THREE.Mesh(geometry(open), mat(CAP.rock));
  openMesh.userData = { pickable: true, cap: true };
  const lockedMesh = new THREE.Mesh(geometry(locked), mat(CAP.locked));
  lockedMesh.userData = { pickable: true, cap: true };
  const beyondMesh = new THREE.Mesh(geometry(beyond), mat(CAP.beyond));
  const wallsMesh = new THREE.Mesh(geometry(cutWalls), mat(CAP.locked));
  // Hairline slot edges on the carved cells, so the grid reads from above.
  const grid: number[] = [];
  hole.ringSlots.slice(0, hole.unlockedRings).forEach((n, ri) => {
    const [r0, r1] = ringRadii(hole, ri + 1);
    for (let slot = 0; slot < n; slot++) {
      const [a] = slotAngles(slot, n);
      grid.push(...at(r0, a, y + 0.01), ...at(r1, a, y + 0.01));
    }
  });
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
  const gridLines = new THREE.LineSegments(gridGeo, material("capGrid", () => new THREE.LineBasicMaterial({ color: 0x1a0f0d, transparent: true, opacity: 0.6 })));
  return [openMesh, lockedMesh, beyondMesh, wallsMesh, gridLines];
}

/** Free what a layout group owns outright. Cached shapes, labels and materials live on for reuse. */
export function disposeLayout(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o.userData.cached) return;
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
  });
}
