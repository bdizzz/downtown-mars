import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import type { Snapshot } from "../sim/snapshot";
import type { Stage, StageOptions, Tool } from "../view/types";
import { FLOOR_H, floorSpan, openShaftRadius, RING_D, TAU } from "./cylinder";
import { buildLayout, disposeLayout, disposeRoomMaterials } from "./rooms3d";

// The 3D view: the same hole as the 2D view, as a real cylinder. Three
// cameras: standing in the shaft looking at the wall, the way someone on the
// gallery would; outside the hole with the near half sliced away (cutaway);
// and straight down the shaft from above. X-ray fades the shaft wall and
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
/** How far the rock backdrop reaches past the outermost ring, and below the dig. */
const SHELL_MARGIN = 6;

type Mode = "shaft" | "cutaway" | "top";
const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: "shaft", name: "Shaft", hint: "Stand in the shaft and look at the wall" },
  { id: "cutaway", name: "Cutaway", hint: "Look at the hole from outside, sliced open" },
  { id: "top", name: "Top", hint: "Look straight down the shaft" },
];

const VIEW_KEY = "downtown-mars.view3d";
function loadView(): { mode: Mode; xray: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}") as Partial<{ mode: Mode; xray: boolean }>;
    return { mode: MODES.some((m) => m.id === v.mode) ? v.mode! : "shaft", xray: !!v.xray };
  } catch {
    return { mode: "shaft", xray: false };
  }
}
function saveView(v: { mode: Mode; xray: boolean }): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    // Not remembered; fine.
  }
}

export async function createStage3D(host: HTMLElement, _opts: StageOptions = {}): Promise<Stage> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    throw new Error("3D needs WebGL, which this browser or device doesn't provide.");
  }
  renderer.setPixelRatio(window.devicePixelRatio);
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
  // The cutaway slices along a plane through the shaft's axis, facing away from the camera.
  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  let shell: THREE.Object3D | null = null;
  let hole: Hole | null = null;
  let holeKey = "";
  let gameId = -1;
  let dirty = true;

  // ---- camera ----

  /**
   * Shaft: looking at the wall point at angle `theta` and height `y`, from
   * `dist` metres away across the shaft. Cutaway: `out` metres from the axis,
   * facing it. Top: `height` metres above the rim, looking down.
   */
  const cam = { theta: Math.PI / 2, y: -FLOOR_H + EYE_HEIGHT, dist: 14, out: CUTAWAY.start, height: TOP.start };

  function maxDist(): number {
    // Stay inside the shaft: no further back than just short of the opposite ledge.
    return hole ? hole.shaftRadiusM + openShaftRadius(hole) - 0.5 : 14;
  }

  function depth(): number {
    return hole ? -floorSpan(hole.floors + 1)[0] : FLOOR_H;
  }

  function clampCamera(): void {
    cam.dist = Math.min(maxDist(), Math.max(MIN_DIST, cam.dist));
    cam.out = Math.min(CUTAWAY.max, Math.max(CUTAWAY.min, cam.out));
    cam.height = Math.min(TOP.max, Math.max(TOP.min, cam.height));
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
    } else if (view.mode === "cutaway") {
      camera.position.copy(out).multiplyScalar(cam.out).setY(cam.y + cam.out * CUTAWAY.lift);
      camera.lookAt(0, cam.y, 0);
      // Keep what's behind the axis from the camera's point of view.
      clip.normal.copy(out).negate();
    } else {
      camera.position.set(0, cam.height, 0);
      // Rotating the "up" direction turns the view around the shaft.
      camera.up.copy(out);
      camera.lookAt(0, -depth(), 0);
    }
    renderer.clippingPlanes = view.mode === "cutaway" ? [clip] : [];
    lamp.visible = view.mode === "shaft";
    fill.intensity = view.mode === "shaft" ? 0.15 : 0.7;
    if (shell) shell.visible = view.mode === "cutaway";
    updateReadout();
    dirty = true;
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
      holeGroup.add(ring);
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(rOpen, rOpen, LEDGE_THICKNESS, 64, 1, true), ledge);
      edge.position.y = y0 + LEDGE_THICKNESS / 2;
      holeGroup.add(edge);
      const railing = new THREE.Mesh(new THREE.TorusGeometry(rOpen + 0.1, 0.05, 6, 96), rail);
      railing.rotation.x = Math.PI / 2;
      railing.position.y = y0 + LEDGE_THICKNESS + RAIL_HEIGHT;
      holeGroup.add(railing);
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

    // The surface around the rim.
    const ground = new THREE.Mesh(
      new THREE.RingGeometry(R, 600, 96, 1),
      new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    holeGroup.add(ground);

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
    // The sun crosses the sky once a day.
    const a = (f - 0.25) * TAU;
    sun.position.set(Math.cos(a) * 100, Math.max(5, Math.sin(a) * 100), 30);
    dirty = true;
  }

  // ---- input ----

  let drag: { x: number; y: number; moved: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > CLICK_SLOP) canvas.style.cursor = "grabbing";
    // Grab the world: dragging left turns you right, dragging up takes you down.
    cam.theta += dx * 0.005;
    if (view.mode !== "top") cam.y += dy * (view.mode === "cutaway" ? 0.15 : 0.05);
    drag.x = e.clientX;
    drag.y = e.clientY;
    applyCamera();
  };
  const onPointerUp = (e: PointerEvent) => {
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = "";
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoom = Math.exp(e.deltaY * 0.01);
    if (view.mode === "top") cam.height *= e.ctrlKey ? zoom : Math.exp(e.deltaY * 0.003);
    else if (e.ctrlKey) {
      if (view.mode === "shaft") cam.dist *= zoom;
      else cam.out *= zoom;
    } else if (e.shiftKey) cam.theta += e.deltaY * 0.003;
    else {
      cam.theta += e.deltaX * 0.003;
      cam.y -= e.deltaY * (view.mode === "cutaway" ? 0.08 : 0.03);
    }
    applyCamera();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---- camera toolbar (owned by this view) ----

  const bar = document.createElement("div");
  bar.className = "cam-toolbar";
  const modeButtons = MODES.map((m) => {
    const b = document.createElement("button");
    b.textContent = m.name;
    b.title = m.hint;
    b.onclick = () => {
      view.mode = m.id;
      saveView(view);
      syncBar();
      applyCamera();
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
    if (latest) stage.update(latest);
  };
  bar.appendChild(xrayButton);
  const readout = document.createElement("span");
  readout.className = "k";
  bar.appendChild(readout);
  host.appendChild(bar);

  function syncBar(): void {
    modeButtons.forEach((b, i) => b.classList.toggle("on", MODES[i]!.id === view.mode));
    xrayButton.classList.toggle("on", view.xray);
  }

  function updateReadout(): void {
    if (view.mode === "top") readout.textContent = "Looking down the shaft";
    else readout.textContent = cam.y >= 0 ? "Surface" : `Floor ${Math.floor(-cam.y / FLOOR_H) + 1}`;
  }
  syncBar();

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

  renderer.setAnimationLoop(() => {
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  });

  let latest: Snapshot | null = null;
  applyCamera();

  const stage: Stage = {
    update(snapshot) {
      latest = snapshot;
      if (snapshot.gameId !== gameId) {
        gameId = snapshot.gameId;
        holeKey = "";
      }
      const key = JSON.stringify(snapshot.layout.hole);
      if (key !== holeKey) {
        holeKey = key;
        hole = snapshot.layout.hole;
        buildHole(hole);
        applyCamera();
      }
      const lk = `${snapshot.gameId}:${snapshot.layout.version}:${snapshot.drill.floor}:${key}:${view.xray}`;
      if (lk !== layoutKey) {
        layoutKey = lk;
        scene.remove(layoutGroup);
        disposeLayout(layoutGroup);
        layoutGroup = buildLayout(snapshot.layout, snapshot.drill.floor, { rock: C.rock, stranded: C.stranded }, view.xray);
        scene.add(layoutGroup);
        dirty = true;
      }
      const d = snapshot.drill;
      digFront.visible = d.floor !== null;
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
      updateSky(snapshot);
    },
    setTool(_t: Tool) {},
    setSelected() {},
    setOverlay() {},
    setColorBlind() {},
    destroy() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      disposeLayout(layoutGroup);
      dispose(holeGroup);
      dispose(digFront);
      disposeRoomMaterials();
      renderer.dispose();
      canvas.remove();
      bar.remove();
    },
  };
  return stage;
}
