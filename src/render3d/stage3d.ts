import * as THREE from "three";
import { previewEffects } from "../sim/effects";
import type { Hole } from "../sim/geometry";
import type { Cell, Layout, RoomInstance } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { Snapshot } from "../sim/snapshot";
import { HEAT } from "../render2d/palette";
import { clickWith, edgeHoverFor, hoverInfoFor, hoverKeyFor, paints } from "../view/interaction";
import { EMPTY_CHAIN, extendChain, type Chain } from "../view/corridorPlan";
import { edgeById, nearestEdge, type Edge } from "../sim/edges";
import type { HoverInfo, Pick, Proposal, Quality, Stage, StageOptions, Tool, Warning } from "../view/types";
import { FLOOR_H, floorSpan, openShaftRadius, RING_D, ringRadii, slotAngles, TAU } from "./cylinder";
import { inCarvedRegion, NUDGE, pickPast, rayCylinder, rayPlane, surfacePickAt } from "./pick3d";
import { config } from "../sim/config";
import { buildLayout, corridorStripGeometry, disposeLayout, disposeRoomMaterials, loweredAt, outlineGeometry, roomGeometry, setNightGlow, setWallsDown, withWallsDown } from "./rooms3d";
import { Dust, galleryLamps, makeLander, placeLander, setLampGlow, Walkers } from "./scenery3d";
import { stairsHere, step as walkStep } from "../view/walk";

// The 3D view: the same hole as the 2D view, as a real cylinder. Four
// cameras: standing in the shaft looking at the wall, the way someone on the
// gallery would; free look from the shaft's axis, aimed anywhere by dragging;
// outside the hole with the near half sliced away (cutaway); and straight
// down the shaft from above. X-ray fades the shaft wall and
// ring 1 so deeper rings show from inside.

const C = {
  rock: 0x6a3a28,
  rockDark: 0x3e2218,
  ledge: 0x8f7a6c,
  rail: 0x8a7466,
  ground: 0x7a3b22,
  stranded: 0xe0503a,
  digFront: 0xe07a3f,
  nightSky: 0x120a14,
  daySky: 0xc98a5e,
};

const LEDGE_THICKNESS = 0.4;
const RAIL_HEIGHT = 1.1;
const EYE_HEIGHT = 1.7;
const FOV = 55;
const MIN_DIST = 2;
const CLICK_SLOP = 5;
const CUTAWAY = { min: 25, max: 300, start: 70, lift: 0.25 };
const TOP = { min: 20, max: 300, start: 80 };
/** Iso: distance to the floor's centre (a multiple of the floor's radius to start), and how steeply it looks down. */
const ISO = { start: 1.6, min: 12, max: 400, elev: 0.75, minElev: 0.3, maxElev: 1.4, lookPast: 0.12 };
/** First person: eye height off the floor, walking and running speed (m/s), how fast dragging (or, locked, the mouse) turns the head, and Q/E turning (rad/s). */
const WALK = { eye: 1.8, speed: 3, run: 7, turn: 0.004, lookTurn: 0.0025, keyTurn: 1.8 };
/** Free look: pitch stops just short of straight up or down; zoom narrows the field of view. */
const FREE = { maxPitch: Math.PI / 2 - 0.02, minFov: 20, maxFov: 90, turn: 0.004 };
/** How much of the surface still shows in x-ray: enough to keep your bearings. */
const XRAY_GROUND_OPACITY = 0.2;
/** How far the rock backdrop reaches past the outermost ring, and below the dig. */
const SHELL_MARGIN = 6;

type Mode = "shaft" | "free" | "cutaway" | "top" | "iso" | "walk";
const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: "shaft", name: "Shaft", hint: "Stand in the shaft and look at the wall" },
  { id: "free", name: "Free", hint: "Stand at the centre of the shaft and drag to look anywhere" },
  { id: "cutaway", name: "Cutaway", hint: "Look at the hole from outside, sliced open" },
  { id: "top", name: "Top", hint: "Look straight down the shaft" },
  { id: "iso", name: "Iso", hint: "One floor from above and off to one side, so you see all of it (pick the floor on the right; drag to turn, scroll to zoom)" },
  { id: "walk", name: "First person", hint: "Walk the galleries, corridors and public spaces: WASD to move, Q and E to turn, drag to look (Tab for mouse look), R and F to take stairs up or down" },
];

const VIEW_KEY = "downtown-mars.view3d";
interface ViewPrefs {
  mode: Mode;
  xray: boolean;
  /** Walls between the camera and the rooms behind them lowered to a stub, as in The Sims. */
  wallsDown: boolean;
}
function loadView(): ViewPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}") as Partial<ViewPrefs>;
    return { mode: MODES.some((m) => m.id === v.mode) ? v.mode! : "iso", xray: !!v.xray, wallsDown: !!v.wallsDown };
  } catch {
    return { mode: "iso", xray: false, wallsDown: false };
  }
}
function saveView(v: ViewPrefs): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    // Not remembered; fine.
  }
}

const HOVER = { ok: 0x7fd67f, bad: 0xe0503a, hover: 0xffe2b0, selected: 0xffffff };
const FIELD_MAX = 3;
/** Overlay tints sit just proud of the cells, in front of the rock and around rooms. */
const FIELD_OUTSET = -0.04;
const FIELD_ALPHA = 0.55;

export async function createStage3D(host: HTMLElement, opts: StageOptions = {}): Promise<Stage> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    throw new Error("3D needs WebGL, which this browser or device doesn't provide.");
  }
  const MAX_PIXEL_RATIO = 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  // Filmic tone mapping keeps the lamp-lit wall from blowing out close up.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 2000);

  const hemi = new THREE.HemisphereLight(0xffe6cc, 0x2a1510, 1.1);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffe0c0, 0.25));
  // A warm lamp that travels with the camera, like a colonist's headlamp,
  // so the shaft reads at night too. Proper lighting comes with rooms.
  const lamp = new THREE.PointLight(0xffd8a8, 40, 60, 1.2);
  camera.add(lamp);
  scene.add(camera);
  // A soft light from the camera's direction, for the outside views where the lamp is too far away.
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.6);
  fill.position.set(0, 0, 0);
  fill.target.position.set(0, 0, -1);
  camera.add(fill, fill.target);
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.2);
  sun.position.set(40, 80, 20);
  scene.add(sun);

  // Everything built from the hole's shape lives in one group, rebuilt when the hole changes.
  let holeGroup = new THREE.Group();
  scene.add(holeGroup);
  // Rooms, the shaft wall around them and surface props: rebuilt when the layout changes.
  let layoutGroup = new THREE.Group();
  scene.add(layoutGroup);
  let layoutKey = "";
  // The dig front: a glowing line that sinks down the wall of the floor being dug.
  const digFront = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.06, 6, 128),
    new THREE.MeshStandardMaterial({ color: C.digFront, emissive: C.digFront, emissiveIntensity: 1.5 }),
  );
  digFront.rotation.x = Math.PI / 2;
  scene.add(digFront);

  const view = loadView();
  // The surface: see-through in x-ray, so rooms under it show from above.
  const groundMat = new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 });
  function applyGroundXray(): void {
    groundMat.transparent = view.xray;
    groundMat.opacity = view.xray ? XRAY_GROUND_OPACITY : 1;
    groundMat.depthWrite = !view.xray;
    groundMat.needsUpdate = true;
    dirty = true;
  }
  // The cutaway slices along a plane through the shaft's axis, facing away from the camera.
  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let shell: THREE.Object3D | null = null;
  // Hover, ghost, halo and selection: rebuilt whenever what they show changes.
  let overlay = new THREE.Group();
  scene.add(overlay);
  let tool: Tool = null;
  let selected: number | null = null;
  let heat = HEAT.normal;
  let layout: Layout | null = null;
  let resources: Record<string, number> = {};
  let hoverKey = "";
  // The heat-map overlay: rebuilt when the overlay, the effects or happiness change.
  let fieldGroup = new THREE.Group();
  scene.add(fieldGroup);
  let overlayType: string | null = null;
  let fieldKey = "";
  let lamps: THREE.InstancedMesh | null = null;
  const lander = makeLander();
  scene.add(lander);
  // Timing for the dev console (window.__stage3d in dev builds only).
  const stats = { buildMs: 0, frameMs: 0, calls: 0, triangles: 0 };
  const walkers = new Walkers();
  const dust = new Dust();
  let quality: Quality = "high";
  /** Real time (ms) the sim last moved; walkers stop when the game is paused. */
  let lastTickChange = 0;
  let lastTick = -1;
  let hole: Hole | null = null;
  let holeKey = "";
  /** The floor picked on the right (null: every floor). */
  let pickedFloor: number | null = null;
  /** Show only this floor and those below it, i.e. deeper (null: every floor). Iso always looks at one floor. */
  const cut = (): number | null => pickedFloor ?? (view.mode === "iso" ? 1 : null);
  let groundMesh: THREE.Mesh | null = null;
  let gameId = "";
  let dirty = true;

  // ---- camera ----

  /**
   * Shaft: looking at the wall point at angle `theta` and height `y`, from
   * `dist` metres away across the shaft. Cutaway: `out` metres from the axis,
   * facing it. Top: `height` metres above the rim, looking down.
   */
  const cam = {
    theta: Math.PI / 2,
    y: -FLOOR_H + EYE_HEIGHT,
    dist: 14,
    out: CUTAWAY.start,
    height: TOP.start,
    /** Free look: where the camera on the axis is pointing, and its field of view. */
    yaw: Math.PI / 2,
    pitch: 0,
    fov: FOV,
    /** Iso: distance from the floor's centre (0 until first used) and elevation in radians. */
    iso: 0,
    isoElev: ISO.elev,
  };
  /** First person: where the walker stands (metres), on which floor, and where they look. */
  const walker = { x: 0, z: 0, floor: 1, yaw: 0, pitch: 0 };

  function maxDist(): number {
    // Stay inside the shaft: no further back than just short of the opposite ledge.
    return hole ? hole.shaftRadiusM + openShaftRadius(hole) - 0.5 : 14;
  }

  /** y of the chosen floor's ceiling, or the surface. */
  function cutTop(): number {
    const f = cut();
    return f === null ? 0 : floorSpan(f)[1];
  }

  /** The outer edge of the unlocked rings. */
  function outerRadius(): number {
    return hole ? ringRadii(hole, hole.unlockedRings)[1] : 40;
  }

  function depth(): number {
    return hole ? -floorSpan(hole.floors + 1)[0] : FLOOR_H;
  }

  function clampCamera(): void {
    cam.dist = Math.min(maxDist(), Math.max(MIN_DIST, cam.dist));
    cam.out = Math.min(CUTAWAY.max, Math.max(CUTAWAY.min, cam.out));
    cam.height = Math.min(TOP.max, Math.max(TOP.min, cam.height));
    cam.pitch = Math.min(FREE.maxPitch, Math.max(-FREE.maxPitch, cam.pitch));
    cam.fov = Math.min(FREE.maxFov, Math.max(FREE.minFov, cam.fov));
    // Iso's distance stays 0 ("not set yet") until the mode is first used and sizes it to the floor.
    if (cam.iso) cam.iso = Math.min(ISO.max, Math.max(ISO.min, cam.iso));
    cam.isoElev = Math.min(ISO.maxElev, Math.max(ISO.minElev, cam.isoElev));
    walker.pitch = Math.min(FREE.maxPitch, Math.max(-FREE.maxPitch, walker.pitch));
    const bottom = -depth() + EYE_HEIGHT;
    cam.y = Math.min(FLOOR_H * 3, Math.max(bottom, cam.y));
  }

  function applyCamera(): void {
    clampCamera();
    const R = hole?.shaftRadiusM ?? 10;
    const out = new THREE.Vector3(Math.cos(cam.theta), 0, Math.sin(cam.theta));
    camera.up.set(0, 1, 0);
    if (view.mode === "shaft") {
      // Above the surface, tip the view down into the hole.
      const target = out.clone().multiplyScalar(R).setY(cam.y - 0.3 - Math.max(0, cam.y) * 2);
      camera.position.copy(target).addScaledVector(out, -cam.dist).setY(cam.y);
      camera.lookAt(target);
    } else if (view.mode === "free") {
      // On the shaft's axis, looking wherever the player has turned.
      camera.position.set(0, cam.y, 0);
      const cp = Math.cos(cam.pitch);
      camera.lookAt(Math.cos(cam.yaw) * cp, cam.y + Math.sin(cam.pitch), Math.sin(cam.yaw) * cp);
    } else if (view.mode === "cutaway") {
      camera.position.copy(out).multiplyScalar(cam.out).setY(cam.y + cam.out * CUTAWAY.lift);
      camera.lookAt(0, cam.y, 0);
      // Keep what's behind the axis from the camera's point of view.
      clip.normal.copy(out).negate();
    } else if (view.mode === "iso") {
      // Above the floor and off to one side, looking across it (a little past its centre, so the far rooms fill the view).
      const y = floorSpan(cut() ?? 1)[0];
      camera.position.copy(out).multiplyScalar(cam.iso * Math.cos(cam.isoElev)).setY(y + cam.iso * Math.sin(cam.isoElev));
      const past = outerRadius() * ISO.lookPast;
      camera.lookAt(-out.x * past, y, -out.z * past);
    } else if (view.mode === "walk") {
      camera.position.set(walker.x, floorSpan(walker.floor)[0] + WALK.eye, walker.z);
      const cp = Math.cos(walker.pitch);
      camera.lookAt(walker.x + Math.cos(walker.yaw) * cp, camera.position.y + Math.sin(walker.pitch), walker.z + Math.sin(walker.yaw) * cp);
    } else {
      // With a floor chosen, look down on it from the same height above its ceiling.
      camera.position.set(0, cam.height + cutTop(), 0);
      // Rotating the "up" direction turns the view around the shaft.
      camera.up.copy(out);
      camera.lookAt(0, -depth(), 0);
    }
    renderer.clippingPlanes = view.mode === "cutaway" ? [clip] : [];
    // Far-off cameras need a farther near plane, or the depth buffer can't tell
    // the ground from the roofs just under it.
    const inside = view.mode === "shaft" || view.mode === "free" || view.mode === "walk";
    const near = inside ? 0.1 : Math.max(0.5, (view.mode === "top" ? cam.height : view.mode === "iso" ? cam.iso : cam.out) / 100);
    const fov = view.mode === "free" ? cam.fov : FOV;
    if (camera.near !== near || camera.fov !== fov) {
      camera.near = near;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    lamp.visible = inside;
    fill.intensity = inside ? 0.15 : 0.7;
    if (shell) shell.visible = view.mode === "cutaway";
    updateReadout();
    dirty = true;
    // The world moved under a still pointer, so what it points at may have changed.
    if (pointer && layout) refreshHover();
  }

  // ---- building the hole ----

  function dispose(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const m = mesh.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
  }

  function buildHole(h: Hole): void {
    scene.remove(holeGroup);
    dispose(holeGroup);
    holeGroup = new THREE.Group();

    const R = h.shaftRadiusM;
    const rOpen = openShaftRadius(h);
    const rockDark = new THREE.MeshStandardMaterial({ color: C.rockDark, roughness: 1, side: THREE.DoubleSide });
    const ledge = new THREE.MeshStandardMaterial({ color: C.ledge, roughness: 0.8 });
    const rail = new THREE.MeshStandardMaterial({ color: C.rail, metalness: 0.4, roughness: 0.5 });

    for (let floor = 1; floor <= h.floors; floor++) {
      const [y0] = floorSpan(floor);
      // The gallery: a ledge ringing the shaft at the floor's base, with a railing on the open side.
      const ring = new THREE.Mesh(new THREE.RingGeometry(rOpen, R, 64), ledge);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y0 + LEDGE_THICKNESS;
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(rOpen, rOpen, LEDGE_THICKNESS, 64, 1, true), ledge);
      edge.position.y = y0 + LEDGE_THICKNESS / 2;
      const railing = new THREE.Mesh(new THREE.TorusGeometry(rOpen + 0.1, 0.05, 6, 96), rail);
      railing.rotation.x = Math.PI / 2;
      railing.position.y = y0 + LEDGE_THICKNESS + RAIL_HEIGHT;
      for (const m of [ring, edge, railing]) m.userData.floor = floor;
      holeGroup.add(ring, edge, railing);
    }

    // Rough rock underfoot at the bottom of the floor being dug.
    const [dy0] = floorSpan(h.floors + 1);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R, 64), rockDark);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = dy0;
    holeGroup.add(bottom);

    // A rock backdrop the cutaway shows behind the rooms: the inside of a
    // cylinder around the whole hole, closed at the bottom.
    // Only the unlocked rings are carved; the backdrop sits just past them.
    const rOuter = R + h.unlockedRings * RING_D + SHELL_MARGIN;
    const deep = -dy0 + SHELL_MARGIN;
    shell = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(rOuter, rOuter, deep, 96, 1, true), new THREE.MeshStandardMaterial({ color: C.rockDark, roughness: 1, side: THREE.BackSide }));
    wall.position.y = -deep / 2;
    const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(rOuter, 96), rockDark);
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = -deep;
    shell.add(wall, floorDisc);
    shell.visible = view.mode === "cutaway";
    holeGroup.add(shell);

    lamps = galleryLamps(h);
    holeGroup.add(lamps);

    // The surface around the rim.
    const ground = new THREE.Mesh(new THREE.RingGeometry(R, 600, 96, 1), groundMat);
    ground.rotation.x = -Math.PI / 2;
    holeGroup.add(ground);
    groundMesh = ground;
    applyFloorCut();

    scene.add(holeGroup);
    dirty = true;
  }

  function updateSky(s: Snapshot): void {
    const f = s.time.dayFraction;
    const light = f > 0.25 && f < 0.75 ? Math.sin((Math.PI * (f - 0.25)) / 0.5) : 0;
    const sky = new THREE.Color(C.nightSky).lerp(new THREE.Color(C.daySky), light);
    scene.background = sky;
    // Deep in the shaft, daylight matters less than the lamps; keep it gentle.
    hemi.intensity = 0.45 + 0.35 * light;
    sun.intensity = 0.15 + 0.9 * light;
    // At night, windows and the gallery lamps glow.
    setNightGlow(1 - light);
    if (lamps) setLampGlow(lamps, 1 - light);
    // The sun crosses the sky once a day.
    const a = (f - 0.25) * TAU;
    sun.position.set(Math.cos(a) * 100, Math.max(5, Math.sin(a) * 100), 30);
    dirty = true;
  }

  // ---- picking ----

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function rayAt(clientX: number, clientY: number): THREE.Ray {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray;
  }

  /** Where along the ray the last pick was read: the corridor tool finds the nearest border to that point. */
  let pickedAt: THREE.Vector3 | null = null;

  /** The nearest thing the ray meets that this camera mode lets you pick. */
  function pickRay(ray: THREE.Ray): Pick {
    pickedAt = null;
    if (!hole) return { kind: "rock" };
    const h = hole;
    let best: { t: number; pick: Pick; at: number } | null = null;
    // `at` is the distance whose point the pick describes (usually just past the hit).
    const offer = (t: number | null, make: () => Pick, at = (t ?? 0) + NUDGE) => {
      if (t !== null && (!best || t < best.t)) best = { t, pick: make(), at };
    };

    const pickables: THREE.Object3D[] = [];
    layoutGroup.traverse((o) => o.userData.pickable && (o as THREE.Mesh).isMesh && pickables.push(o));
    for (const hit of raycaster.intersectObjects(pickables, false)) {
      const u = hit.object.userData;
      // The raycaster ignores clipping: skip what the cutaway has sliced away.
      if (view.mode === "cutaway" && clip.distanceToPoint(hit.point) < -0.01) continue;
      // In x-ray the wall and ring 1 are see-through: pick what's behind them.
      if (view.xray && u.faint) continue;
      // With walls down, a lowered wall isn't there: pick the room behind it.
      if (loweredAt(hit, camera.position)) continue;
      // The cap over a chosen floor: pick the cell just under it.
      if (u.surface) offer(hit.distance, () => surfacePickAt(hit.point));
      // A corridor floor, or a room's floor seen from above (rooms have no ceilings):
      // what's just above it, on its floor, not the floor below.
      else if (u.hall || u.empty || (u.roomId !== undefined && Math.abs(hit.face?.normal.y ?? 0) > 0.9 && ray.direction.y < 0)) {
        offer(hit.distance, () => pickPast(h, ray, hit.distance - 0.3), hit.distance - 0.3 + NUDGE);
      }
      else offer(hit.distance, () => pickPast(h, ray, hit.distance));
      break;
    }
    // The ground around the rim, for surface buildings. In x-ray you're looking
    // through it, so it only counts when placing a surface building or when
    // nothing underneath was hit.
    const tGround = rayPlane(ray, ground);
    const groundPick = (): Pick => {
      const p = ray.at(tGround!, new THREE.Vector3());
      return Math.hypot(p.x, p.z) > h.shaftRadiusM ? surfacePickAt(p) : { kind: "rock" };
    };
    const placingOnSurface = tool?.kind === "build" && roomDef(tool.room).size === "surface";
    // With a floor chosen, the surface is hidden: nothing up there to pick.
    const surfaceShown = cut() === null;
    if (surfaceShown && (!view.xray || placingOnSurface)) offer(tGround, groundPick);
    const inShaft = view.mode === "shaft" || view.mode === "free" || view.mode === "walk";
    if (inShaft && !view.xray) {
      // Empty wall faces are part of the wall mesh; nothing more to add.
    } else if (inShaft && view.xray) {
      // Just behind ring 1: ring 2's inner face.
      const t = rayCylinder(ray, h.shaftRadiusM + RING_D);
      if (t !== null && inCarvedRegion(h, ray.at(t + 0.1, new THREE.Vector3()))) offer(t, () => pickPast(h, ray, t));
    } else if (view.mode === "cutaway") {
      // The sliced section itself: how you reach rings 2 and 3 from outside.
      const t = rayPlane(ray, clip);
      if (t !== null && inCarvedRegion(h, ray.at(t, new THREE.Vector3()))) offer(t, () => pickPast(h, ray, t - 0.2));
    }
    const b = best as { t: number; pick: Pick; at: number } | null;
    if (!b && tGround !== null && surfaceShown) return groundPick();
    if (b) pickedAt = ray.at(b.at, new THREE.Vector3());
    return b ? b.pick : { kind: "rock" };
  }

  // ---- hover, ghost, halo, selection ----

  const overlayMats = new Map<string, THREE.Material>();
  function overlayMat(key: string, make: () => THREE.Material): THREE.Material {
    let m = overlayMats.get(key);
    if (!m) overlayMats.set(key, (m = make()));
    return m;
  }
  const solid = (color: number, opacity: number) =>
    // Drawn over everything, so a ghost or halo shows even inside a room or behind the wall.
    overlayMat(`s:${color}:${opacity}`, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  const lines = (color: number) => overlayMat(`l:${color}`, () => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
  // Halos and tints over rooms lower with the walls they cover.
  const wallSolid = (color: number, opacity: number) =>
    overlayMat(`ws:${color}:${opacity}`, () => withWallsDown(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide })));
  const wallLines = (color: number) => overlayMat(`wl:${color}`, () => withWallsDown(new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })));

  // "45%" over rooms under construction, updated as the crews work.
  const progressGroup = new THREE.Group();
  scene.add(progressGroup);
  const percentMats = new Map<string, THREE.SpriteMaterial>();
  let progressKey = "";
  function percentMaterial(text: string): THREE.SpriteMaterial {
    let m = percentMats.get(text);
    if (m) return m;
    const c = document.createElement("canvas");
    // Room for "⛏ 100%" while digging.
    c.width = 144;
    c.height = 48;
    const g = c.getContext("2d")!;
    g.font = "800 30px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 7;
    g.strokeStyle = "#1a0f0d";
    g.strokeText(text, 72, 25);
    g.fillStyle = "#ffffff";
    g.fillText(text, 72, 25);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    percentMats.set(text, m);
    return m;
  }
  function drawProgress(s: Snapshot): void {
    const key = `${s.layout.version}:${cut()}:` + s.construction.jobs.map((j) => `${j.roomId}:${j.phase}:${Math.floor(j.progress * 100)}`).join(",");
    if (key === progressKey) return;
    progressKey = key;
    progressGroup.clear();
    const h = s.layout.hole;
    const cf = cut();
    for (const job of s.construction.jobs) {
      const room = job.roomId !== undefined ? s.layout.rooms.find((r) => r.id === job.roomId) : undefined;
      if (!room || room.at.kind !== "ring") continue;
      const cells = (job.kind === "extend" ? (room.pendingCells ?? []) : room.cells).filter((c) => cf === null || c.floor >= cf);
      const c = cells[0];
      if (!c) continue;
      const n = h.ringSlots[c.ring - 1]!;
      const [a0, a1] = slotAngles(c.slot, n);
      const [r0, r1] = ringRadii(h, c.ring);
      const [y0, y1] = floorSpan(c.floor);
      const a = (a0 + a1) / 2;
      const r = c.ring === 1 ? r0 - 0.8 : (r0 + r1) / 2;
      const sprite = new THREE.Sprite(percentMaterial(`${job.phase === "excavating" ? "⛏" : ""}${Math.floor(job.progress * 100)}%`));
      sprite.scale.set(3.6, 1.2, 1);
      sprite.position.set(r * Math.cos(a), (y0 + y1) / 2, r * Math.sin(a));
      sprite.renderOrder = 11;
      progressGroup.add(sprite);
    }
    dirty = true;
  }

  let plusMat: THREE.SpriteMaterial | null = null;
  /** A plus in a disc, drawn once: "this adds to what's there". */
  function plusMaterial(): THREE.SpriteMaterial {
    if (plusMat) return plusMat;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(26, 15, 13, 0.8)";
    g.strokeStyle = "#7fd67f";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(18, 32);
    g.lineTo(46, 32);
    g.moveTo(32, 18);
    g.lineTo(32, 46);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    plusMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    return plusMat;
  }

  function outline(cells: Cell[], color: number): void {
    if (!layout || !cells.length) return;
    const geo = roomGeometry(layout, cells);
    const edges = new THREE.LineSegments(outlineGeometry(geo), wallLines(color));
    edges.renderOrder = 10;
    overlay.add(edges);
    geo.dispose();
  }

  function fillCells(cells: Cell[], color: number, opacity: number): void {
    if (!layout || !cells.length) return;
    const mesh = new THREE.Mesh(roomGeometry(layout, cells), wallSolid(color, opacity));
    mesh.renderOrder = 9;
    overlay.add(mesh);
  }

  function surfaceMarker(slots: number[], color: number): void {
    if (!layout || !hole) return;
    const total = layout.surface.length;
    const mid = ((Math.min(...slots) + slots.length / 2) / total) * TAU;
    const r = hole.shaftRadiusM + 16;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4 + 3 * slots.length, 32), solid(color, 0.35));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(r * Math.cos(mid), 0.15, r * Math.sin(mid));
    overlay.add(disc);
  }

  function markRoom(room: RoomInstance, color: number): void {
    if (room.at.kind === "surface") surfaceMarker(room.surfaceCells, color);
    else outline(room.cells, color);
  }

  /** The room's strongest effect, spread the way the sim spreads it, as tinted cells. */
  function drawHalo(type: string, cells: Cell[]): void {
    if (!layout) return;
    const effects = roomDef(type).effects.filter((e) => !e.residentsOnly && e.radius > 0);
    if (!effects.length) return;
    const main = effects.reduce((a, b) => (Math.abs(b.strength) > Math.abs(a.strength) ? b : a));
    const grid = previewEffects(layout, type, cells)[main.type];
    if (!grid) return;
    const own = new Set(cells.map((c) => `${c.floor}:${c.ring}:${c.slot}`));
    // Group cells by strength so each band is one mesh.
    const bands = new Map<number, Cell[]>();
    grid.forEach((rings, fi) =>
      rings.forEach((slots, ri) =>
        slots.forEach((v, slot) => {
          if (Math.abs(v) < 0.05 || own.has(`${fi + 1}:${ri + 1}:${slot}`)) return;
          const band = Math.round(v * 3) / 3;
          if (!bands.has(band)) bands.set(band, []);
          bands.get(band)!.push({ floor: fi + 1, ring: ri + 1, slot });
        }),
      ),
    );
    for (const [v, list] of bands) {
      const alpha = Math.min(1, Math.abs(v) / FIELD_MAX) * 0.6;
      for (const c of list) fillCells([c], v < 0 ? heat.bad : heat.good, alpha);
    }
  }

  /** A border highlighted on its floor, where the corridor is (or will be), outlined so it reads against any finish. */
  function ghostEdge(id: string, color: number): void {
    if (!layout) return;
    const e = edgeById(layout.hole, id);
    if (!e) return;
    const y = floorSpan(e.floor)[0] + 0.08;
    const strip = new THREE.Mesh(corridorStripGeometry(layout, e, y), solid(color, 0.55));
    strip.renderOrder = 9;
    overlay.add(strip);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(strip.geometry), lines(color));
    edges.renderOrder = 10;
    overlay.add(edges);
  }

  function drawOverlay(info: HoverInfo | null): void {
    scene.remove(overlay);
    overlay.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
    });
    overlay = new THREE.Group();
    scene.add(overlay);
    dirty = true;
    if (!layout) return;
    const sel = selected !== null ? layout.rooms.find((r) => r.id === selected) : undefined;
    if (sel) markRoom(sel, HOVER.selected);
    // A warning is up: the corridors it would fill in, and whatever they'd cut off, in red.
    if (warning) {
      for (const id of warning.edges) ghostEdge(id, HOVER.bad);
      for (const id of warning.rooms) {
        const r = layout.rooms.find((x) => x.id === id);
        if (r) markRoom(r, HOVER.bad);
      }
    }
    // A snaked chain (while dragging, or waiting for confirmation): every border highlighted.
    const shown = snaking ? { edges: chain.edges, erase: chainErase } : proposal;
    if (shown?.edges.length) {
      for (const id of shown.edges) ghostEdge(id, shown.erase ? HOVER.bad : layout.corridors[id] ? HOVER.hover : HOVER.ok);
      return;
    }
    if (!info) return;
    const p = info.pick;
    if (info.edge) {
      ghostEdge(info.edge.id, info.edge.refusal || info.edge.erase ? HOVER.bad : HOVER.ok);
      return;
    }
    if (tool?.kind === "build" && info.check) {
      const color = info.check.ok ? HOVER.ok : HOVER.bad;
      const cells = info.check.cells.length ? info.check.cells : p.kind === "slot" ? [p as Cell] : [];
      fillCells(cells, color, 0.4);
      outline(cells, color);
      if (info.check.surfaceCells.length) surfaceMarker(info.check.surfaceCells, color);
      if (info.check.ok && cells.length) drawHalo(tool.room, cells);
      // Extending stairs or an elevator: a plus floating on the piece being added.
      if (info.check.ok && info.check.merges && p.kind === "slot") {
        const n = layout.hole.ringSlots[p.ring - 1]!;
        const [a0, a1] = slotAngles(p.slot, n);
        const [r0, r1] = ringRadii(layout.hole, p.ring);
        const [y0, y1] = floorSpan(p.floor);
        const a = (a0 + a1) / 2;
        const r = p.ring === 1 ? r0 - 0.4 : (r0 + r1) / 2;
        const plus = new THREE.Sprite(plusMaterial());
        plus.scale.set(2.2, 2.2, 1);
        plus.position.set(r * Math.cos(a), (y0 + y1) / 2, r * Math.sin(a));
        plus.renderOrder = 11;
        overlay.add(plus);
      }
      return;
    }
    if (info.room) {
      if (info.room.id !== selected || tool?.kind === "demolish") markRoom(info.room, tool?.kind === "demolish" ? HOVER.bad : HOVER.hover);
      return;
    }
    if (p.kind === "slot") outline([p as Cell], HOVER.hover);
  }

  /** Tint cells by an effect, or homes by happiness, banded so each band is one mesh. */
  function buildField(s: Snapshot): void {
    scene.remove(fieldGroup);
    fieldGroup.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
    fieldGroup = new THREE.Group();
    scene.add(fieldGroup);
    dirty = true;
    if (!overlayType) return;
    const l = s.layout;
    const bands = new Map<number, Cell[]>();
    const add = (v: number, cells: Cell[]) => {
      if (Math.abs(v) < 0.05) return;
      const band = Math.round(v * 2) / 2;
      if (!bands.has(band)) bands.set(band, []);
      bands.get(band)!.push(...cells);
    };
    if (overlayType === "happiness") {
      for (const pool of s.happiness.pools) {
        const room = l.rooms.find((r) => r.id === pool.roomId);
        if (!room) continue;
        const v = ((pool.happiness - 50) / 50) * FIELD_MAX;
        if (room.at.kind === "surface") {
          const color = v < 0 ? heat.bad : heat.good;
          const total = l.surface.length;
          const mid = ((Math.min(...room.surfaceCells) + room.surfaceCells.length / 2) / total) * TAU;
          const r = l.hole.shaftRadiusM + 16;
          const disc = new THREE.Mesh(new THREE.CircleGeometry(8, 32), solid(color, Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA));
          disc.rotation.x = -Math.PI / 2;
          disc.position.set(r * Math.cos(mid), 0.2, r * Math.sin(mid));
          fieldGroup.add(disc);
        } else add(v, room.cells);
      }
    } else {
      const grid = s.effects[overlayType];
      grid?.forEach((rings, fi) => {
        for (let ring = 1; ring <= l.hole.unlockedRings; ring++) {
          rings[ring - 1]?.forEach((v, slot) => add(v, [{ floor: fi + 1, ring, slot }]));
        }
      });
    }
    for (const [v, cells] of bands) {
      const color = v < 0 ? heat.bad : heat.good;
      const alpha = Math.min(1, Math.abs(v) / FIELD_MAX) * FIELD_ALPHA;
      const mat = overlayMat(`f:${color}:${alpha}`, () =>
        withWallsDown(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide })),
      );
      fieldGroup.add(new THREE.Mesh(roomGeometry(l, cells, FIELD_OUTSET, false), mat));
    }
  }

  let pointer: { clientX: number; clientY: number } | null = null;

  /** Shift erases with the corridor tool. */
  let shift = false;

  /** The border nearest the point the last pick landed on. */
  function edgeAtPick(p: Pick): Edge | null {
    if (!hole || !pickedAt || (p.kind !== "slot" && p.kind !== "gallery")) return null;
    const r = Math.hypot(pickedAt.x, pickedAt.z);
    const rings = Math.max(0.001, (r - hole.shaftRadiusM) / RING_D);
    return nearestEdge(hole, p.floor, rings, Math.atan2(pickedAt.z, pickedAt.x) / TAU, RING_D);
  }

  function hoverInfo(): HoverInfo | null {
    if (!layout || !pointer) return null;
    rayAt(pointer.clientX, pointer.clientY);
    const p = pickRay(raycaster.ray);
    if (tool?.kind === "corridor") return edgeHoverFor(layout, resources, tool, p, edgeAtPick(p), shift);
    return hoverInfoFor(layout, resources, tool, p, latest?.holeGates ?? []);
  }

  function refreshHover(force = false): void {
    const info = hoverInfo();
    const key = hoverKeyFor(info, tool, layout?.version ?? -1, selected) + view.mode + view.xray;
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

  function edgeUnderPointer(): Edge | null {
    if (!layout || !pointer) return null;
    rayAt(pointer.clientX, pointer.clientY);
    return edgeAtPick(pickRay(raycaster.ray));
  }

  function snake(): void {
    if (!layout) return;
    const next = extendChain(layout, chain, edgeUnderPointer(), chainErase);
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



  // ---- first person ----

  const held = new Set<string>();
  let walkerPlaced = false;
  /** Mouse look: the pointer locked to the view (Tab), where the browser allows it. */
  const locked = () => document.pointerLockElement === canvas;
  const centre = () => {
    const r = canvas.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  };
  const crosshair = document.createElement("div");
  crosshair.className = "walk-crosshair";
  crosshair.style.display = "none";
  host.appendChild(crosshair);

  /** Stand on the gallery of the floor you were looking at, facing along it. */
  function placeWalker(): void {
    if (!hole || !layout) return;
    const floor = Math.min(hole.floors, Math.max(1, pickedFloor ?? Math.floor(-cam.y / FLOOR_H) + 1));
    const r = (openShaftRadius(hole) + hole.shaftRadiusM) / 2;
    walker.floor = floor;
    walker.x = r * Math.cos(cam.theta);
    walker.z = r * Math.sin(cam.theta);
    walker.yaw = cam.theta + Math.PI / 2;
    walker.pitch = 0;
    walkerPlaced = true;
  }

  /** What the readout says while walking: where, and what the keys do. */
  function walkReadout(): string {
    const stairs = layout ? stairsHere(layout, walker.floor, walker.x, walker.z) : null;
    const flights = stairs ? ` · stairs: ${[stairs.up !== null ? "R up" : "", stairs.down !== null ? "F down" : ""].filter(Boolean).join(", ")}` : "";
    const look = locked() ? "mouse to look (Tab or Esc to stop)" : "drag to look (Tab for mouse look)";
    return `Floor ${walker.floor} · WASD to move, Q/E to turn, ${look}${flights}`;
  }

  /** Switching camera mode: set the new one up, and rebuild if what's hidden changed. */
  function enterMode(before: Mode): void {
    if (view.mode === "iso" && !cam.iso) cam.iso = outerRadius() * ISO.start;
    if (view.mode === "walk" && before !== "walk") placeWalker();
    if (before === "walk" && view.mode !== "walk") {
      held.clear();
      if (locked()) document.exitPointerLock();
    }
    if ((before === "walk") !== (view.mode === "walk")) opts.onWalking?.(view.mode === "walk");
    applyFloorCut();
    applyCamera();
    if (latest) stage.update(latest);
  }

  /** Take the stairs (or an elevator) you're standing in, up or down a floor. */
  function takeStairs(dir: "up" | "down"): void {
    if (!layout) return;
    const to = stairsHere(layout, walker.floor, walker.x, walker.z)?.[dir];
    if (to === null || to === undefined) return;
    walker.floor = to;
    applyCamera();
  }

  const WALK_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "q", "e", "r", "f", "tab"]);
  // Captured before the rest of the app sees them, so walking doesn't pick rooms by their keys.
  const onWalkKey = (e: KeyboardEvent) => {
    if (view.mode !== "walk") return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (!WALK_KEYS.has(k)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "keyup") {
      held.delete(k);
      return;
    }
    if (e.repeat && (k === "r" || k === "f" || k === "tab")) return;
    if (k === "r") takeStairs("up");
    else if (k === "f") takeStairs("down");
    else if (k === "tab") {
      if (locked()) document.exitPointerLock();
      else canvas.requestPointerLock?.()?.catch?.(() => {});
    } else held.add(k);
  };
  window.addEventListener("keydown", onWalkKey, { capture: true });
  window.addEventListener("keyup", onWalkKey, { capture: true });
  // Keys let go while the window is away never send a keyup: stop walking.
  const onBlur = () => held.clear();
  window.addEventListener("blur", onBlur);
  const onLockChange = () => {
    crosshair.style.display = view.mode === "walk" && locked() ? "block" : "none";
    updateReadout();
  };
  document.addEventListener("pointerlockchange", onLockChange);

  /** One frame's walking: returns true if the walker moved. */
  function walkFrame(dt: number): boolean {
    if (view.mode !== "walk" || !layout || !held.size) return false;
    const turn = (held.has("e") ? 1 : 0) - (held.has("q") ? 1 : 0);
    walker.yaw += turn * WALK.keyTurn * dt;
    const fwd = (held.has("w") || held.has("arrowup") ? 1 : 0) - (held.has("s") || held.has("arrowdown") ? 1 : 0);
    const side = (held.has("d") || held.has("arrowright") ? 1 : 0) - (held.has("a") || held.has("arrowleft") ? 1 : 0);
    if (!fwd && !side) return turn !== 0;
    const speed = (held.has("shift") ? WALK.run : WALK.speed) * dt;
    const len = Math.hypot(fwd, side);
    const [fx, fz] = [Math.cos(walker.yaw), Math.sin(walker.yaw)];
    // Right of facing (fx, fz) is (−fz, fx).
    const dx = ((fwd * fx - side * fz) / len) * speed;
    const dz = ((fwd * fz + side * fx) / len) * speed;
    const [x, z] = walkStep(layout, walker.floor, walker.x, walker.z, dx, dz);
    if (x === walker.x && z === walker.z) return turn !== 0;
    walker.x = x;
    walker.z = z;
    return true;
  }

  // ---- input ----

  let drag: { x: number; y: number; moved: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // Mouse look: clicks land where the crosshair is.
    if (view.mode === "walk" && locked()) {
      pointer = centre();
      const info = layout ? hoverInfo() : null;
      if (info && layout) clickWith(layout, tool, info, opts);
      return;
    }

    pointer = e; // a tap may arrive with no move before it
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
    if (view.mode === "walk" && locked()) {
      walker.yaw += e.movementX * WALK.lookTurn;
      walker.pitch -= e.movementY * WALK.lookTurn;
      pointer = centre();
      applyCamera();
      return;
    }
    pointer = e;
    shift = e.shiftKey;
    if (snaking) {
      snake();
      return;
    }
    if (!drag) {
      refreshHover();
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > CLICK_SLOP) canvas.style.cursor = "grabbing";
    if (view.mode === "free") {
      // Grab the view: the world follows the pointer, so dragging up looks down.
      cam.yaw += dx * FREE.turn * (cam.fov / FOV);
      cam.pitch += dy * FREE.turn * (cam.fov / FOV);
    } else if (view.mode === "walk") {
      // Turn your head: drag right to look right, up to look up.
      walker.yaw += dx * WALK.turn;
      walker.pitch -= dy * WALK.turn;
    } else {
      // Grab the world: dragging left turns you right, dragging up takes you down (or, in iso, looks from higher up).
      cam.theta += dx * 0.005;
      if (view.mode === "iso") cam.isoElev += dy * 0.004;
      else if (view.mode !== "top") cam.y += dy * (view.mode === "cutaway" ? 0.15 : 0.05);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    applyCamera();
  };
  const onPointerUp = (e: PointerEvent) => {
    if (view.mode === "walk" && locked()) return;
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
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoom = Math.exp(e.deltaY * 0.01);
    if (view.mode === "walk") return;
    if (view.mode === "iso") {
      if (e.shiftKey) cam.theta += e.deltaY * 0.003;
      else cam.iso *= Math.exp(e.deltaY * 0.003);
      applyCamera();
      return;
    }
    if (view.mode === "top") cam.height *= e.ctrlKey ? zoom : Math.exp(e.deltaY * 0.003);
    else if (view.mode === "free") {
      if (e.ctrlKey) cam.fov *= zoom;
      else {
        cam.yaw += e.deltaX * 0.003;
        cam.y -= e.deltaY * 0.03;
      }
    } else if (e.ctrlKey) {
      if (view.mode === "shaft") cam.dist *= zoom;
      else cam.out *= zoom;
    } else if (e.shiftKey) cam.theta += e.deltaY * 0.003;
    else {
      cam.theta += e.deltaX * 0.003;
      cam.y -= e.deltaY * (view.mode === "cutaway" ? 0.08 : 0.03);
    }
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
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    opts.onCancel?.();
  });
  const onPointerLeave = () => {
    pointer = null;
    refreshHover();
  };
  canvas.addEventListener("pointerleave", onPointerLeave);

  // ---- camera toolbar (owned by this view) ----

  const bar = document.createElement("div");
  bar.className = "cam-toolbar";
  const modeButtons = MODES.map((m) => {
    const b = document.createElement("button");
    b.textContent = m.name;
    b.title = m.hint;
    b.onclick = () => {
      // Coming from the shaft view, keep facing the same way.
      if (m.id === "free" && view.mode !== "free") {
        cam.yaw = cam.theta;
        cam.pitch = 0;
      }
      const before = view.mode;
      view.mode = m.id;
      saveView(view);
      syncBar();
      enterMode(before);
    };
    bar.appendChild(b);
    return b;
  });
  const xrayButton = document.createElement("button");
  xrayButton.textContent = "X-ray";
  xrayButton.title = "Fade the shaft wall and ring 1 to see deeper rings";
  xrayButton.onclick = () => {
    view.xray = !view.xray;
    saveView(view);
    syncBar();
    layoutKey = ""; // rebuild with the new materials on the next update
    applyGroundXray();
    if (latest) stage.update(latest);
  };
  bar.appendChild(xrayButton);
  const wallsButton = document.createElement("button");
  wallsButton.textContent = "Walls down";
  wallsButton.title = "Lower the walls between you and the rooms behind them, to see inside";
  wallsButton.onclick = () => {
    view.wallsDown = !view.wallsDown;
    saveView(view);
    syncBar();
    setWallsDown(view.wallsDown);
    dirty = true;
    if (pointer && layout) refreshHover();
  };
  bar.appendChild(wallsButton);
  const readout = document.createElement("span");
  readout.className = "k";
  bar.appendChild(readout);
  host.appendChild(bar);

  function syncBar(): void {
    modeButtons.forEach((b, i) => b.classList.toggle("on", MODES[i]!.id === view.mode));
    xrayButton.classList.toggle("on", view.xray);
    wallsButton.classList.toggle("on", view.wallsDown);
  }

  function updateReadout(): void {
    const f = cut();
    if (view.mode === "walk") readout.textContent = walkReadout();
    else if (view.mode === "iso") readout.textContent = `Floor ${f}, isometric`;
    else if (f !== null) readout.textContent = `Floor ${f}${view.mode === "top" ? " from above" : " and below"}`;
    else if (view.mode === "top") readout.textContent = "Looking down the shaft";
    else readout.textContent = cam.y >= 0 ? "Surface" : `Floor ${Math.floor(-cam.y / FLOOR_H) + 1}`;
  }
  syncBar();
  applyGroundXray();
  setWallsDown(view.wallsDown);
  // Restored in first person: no building while walking.
  if (view.mode === "walk") opts.onWalking?.(true);

  const resize = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  });
  resize.observe(host);

  // Ambient life (dust, walkers) animates at up to 30 fps; camera moves and
  // sim changes still render on the next frame.
  const AMBIENT_FPS = 30;
  const clock = new THREE.Clock();
  let ambient = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.1, clock.getDelta());
    ambient += dt;
    if (walkFrame(dt)) {
      applyCamera();
      updateReadout();
    }
    if (quality === "high" && hole && ambient >= 1 / AMBIENT_FPS) {
      dust.step(ambient);
      if (performance.now() - lastTickChange < 400) walkers.step(ambient);
      ambient = 0;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    const t0 = performance.now();
    renderer.render(scene, camera);
    stats.frameMs = performance.now() - t0;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
  });

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    opts.onError?.("The 3D view lost its graphics context (the GPU may be busy or asleep). Switched to 2D.");
  });

  /** Hide what sits above the chosen floor: ledges, lamps, walkers, the surface. */
  function applyFloorCut(): void {
    holeGroup.traverse((o) => {
      const f = cut();
      if (typeof o.userData.floor === "number") o.visible = f === null || o.userData.floor >= f;
    });
    if (groundMesh) groundMesh.visible = cut() === null;
    if (lamps) lamps.visible = cut() === null;
    walkers.mesh.visible = quality === "high" && cut() === null;
    dust.points.visible = quality === "high" && cut() === null;
    dirty = true;
  }

  function applyQuality(): void {
    renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO) : 1);
    renderer.setSize(host.clientWidth, host.clientHeight);
    applyFloorCut();
  }
  scene.add(walkers.mesh, dust.points);

  let latest: Snapshot | null = null;
  applyCamera();

  const stage: Stage = {
    update(snapshot) {
      latest = snapshot;
      layout = snapshot.layout;
      if (import.meta.env.DEV) {
        // For the dev console: timings, plus a synchronous render timed through the GPU.
        (window as unknown as { __stage3d: unknown }).__stage3d = {
          ...stats,
          measure(): number {
            const gl = renderer.getContext();
            const t0 = performance.now();
            renderer.render(scene, camera);
            gl.finish();
            return performance.now() - t0;
          },
          setMode(m: Mode) {
            view.mode = m;
            syncBar();
            applyCamera();
          },
        };
      }
      resources = snapshot.resources;
      if (snapshot.tick !== lastTick) {
        lastTick = snapshot.tick;
        lastTickChange = performance.now();
      }
      const identity = `${snapshot.gameId}:${snapshot.holeId}`;
      if (identity !== gameId) {
        // A new game, a loaded save or another hole: rebuild from scratch.
        gameId = identity;
        holeKey = "";
        layoutKey = "";
        fieldKey = "";
        selected = null;
      }
      const key = JSON.stringify(snapshot.layout.hole);
      if (key !== holeKey) {
        holeKey = key;
        hole = snapshot.layout.hole;
        buildHole(hole);
        dust.sync(hole);
        applyCamera();
      }
      // Remembered in iso: frame the floor once there's a hole to frame.
      if (view.mode === "iso" && !cam.iso) {
        cam.iso = outerRadius() * ISO.start;
        applyCamera();
      }
      // Remembered in first person: stand somewhere once there's a hole to stand in.
      if (view.mode === "walk" && !walkerPlaced) {
        placeWalker();
        applyCamera();
      }
      const lk = `${gameId}:${snapshot.layout.version}:${snapshot.drill.floor}:${key}:${view.xray}:${cut()}`;
      if (lk !== layoutKey) {
        layoutKey = lk;
        scene.remove(layoutGroup);
        disposeLayout(layoutGroup);
        const t0 = performance.now();
        layoutGroup = buildLayout(snapshot.layout, snapshot.drill.floor, { rock: C.rock, stranded: C.stranded }, view.xray, cut());
        stats.buildMs = performance.now() - t0;
        scene.add(layoutGroup);
        dirty = true;
      }
      const d = snapshot.drill;
      const cf = cut();
      digFront.visible = d.floor !== null && (cf === null || d.floor >= cf);
      if (d.floor !== null) {
        const [, top] = floorSpan(d.floor);
        const r = snapshot.layout.hole.shaftRadiusM - 0.05;
        digFront.scale.set(r, r, 1);
        const y = top - d.progress * FLOOR_H;
        if (Math.abs(digFront.position.y - y) > 0.01) {
          digFront.position.y = y;
          dirty = true;
        }
      }
      walkers.sync(snapshot.layout.hole, snapshot.population.count);
      updateSky(snapshot);
      const happy = overlayType === "happiness" ? snapshot.happiness.pools.map((p) => Math.round(p.happiness)).join(",") : "";
      const fk = `${overlayType}:${gameId}:${snapshot.layout.version}:${happy}:${heat.bad}`;
      if (fk !== fieldKey) {
        fieldKey = fk;
        buildField(snapshot);
      }
      const e = snapshot.earth;
      const descent = config.earth.descentDays * config.ticksPerDay;
      const landing = e.padReady && !e.waiting && e.ticksToDrop <= descent;
      const wasVisible = lander.visible;
      placeLander(lander, snapshot.layout, landing && cut() === null ? 1 - e.ticksToDrop / descent : null);
      if (landing || wasVisible) dirty = true;
      drawProgress(snapshot);
      refreshHover(); // affordability or the layout may have changed
    },
    setTool(t: Tool) {
      tool = t;
      refreshHover(true);
    },
    setSelected(id) {
      selected = id;
      refreshHover(true);
    },
    setProposal(p) {
      proposal = p;
      refreshHover(true);
    },
    setWarning(w) {
      warning = w;
      refreshHover(true);
    },
    setQuality(q) {
      quality = q;
      applyQuality();
    },
    setFloor(f) {
      if (f === pickedFloor) return;
      pickedFloor = f;
      layoutKey = ""; // rebuild without the floors above
      applyFloorCut();
      applyCamera();
      if (latest) stage.update(latest);
    },
    setOverlay(type) {
      overlayType = type;
      fieldKey = "";
      if (latest) stage.update(latest);
    },
    setColorBlind(on) {
      heat = on ? HEAT.colorBlind : HEAT.normal;
      fieldKey = "";
      if (latest) stage.update(latest);
      refreshHover(true);
    },
    destroy() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("keydown", onWalkKey, { capture: true });
      window.removeEventListener("keyup", onWalkKey, { capture: true });
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (locked()) document.exitPointerLock();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      resize.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      disposeLayout(layoutGroup);
      dispose(holeGroup);
      dispose(digFront);
      dispose(lander);
      groundMat.dispose();
      dispose(walkers.mesh);
      dispose(dust.points);
      fieldGroup.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      disposeRoomMaterials();
      overlayMats.forEach((m) => m.dispose());
      plusMat?.map?.dispose();
      plusMat?.dispose();
      percentMats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      canvas.remove();
      bar.remove();
    },
  };
  return stage;
}
