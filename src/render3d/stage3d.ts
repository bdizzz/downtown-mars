import * as THREE from "three";
import type { Hole } from "../sim/geometry";
import type { Snapshot } from "../sim/snapshot";
import type { Stage, StageOptions, Tool } from "../view/types";
import { FLOOR_H, floorSpan, openShaftRadius, slotAngles, TAU } from "./cylinder";

// The 3D view: the same hole as the 2D view, as a real cylinder. The camera
// stands in the shaft and looks at the wall, the way someone on the gallery
// would. Drag to turn around the shaft and move up and down; scroll to move
// between floors; pinch or ctrl+scroll to step closer or back.

const C = {
  rock: 0x6a3a28,
  rockDark: 0x3e2218,
  ledge: 0x8f7a6c,
  rail: 0x8a7466,
  ground: 0x7a3b22,
  nightSky: 0x120a14,
  daySky: 0xc98a5e,
};

/** Segments per slot face: enough that a narrow hole still looks round. */
const ARC_STEPS = 4;
const LEDGE_THICKNESS = 0.4;
const RAIL_HEIGHT = 1.1;
const EYE_HEIGHT = 1.7;
const FOV = 55;
const MIN_DIST = 2;
const CLICK_SLOP = 5;

export async function createStage3D(host: HTMLElement, _opts: StageOptions = {}): Promise<Stage> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    throw new Error("3D needs WebGL, which this browser or device doesn't provide.");
  }
  renderer.setPixelRatio(window.devicePixelRatio);
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
  const lamp = new THREE.PointLight(0xffd8a8, 250, 60, 1.2);
  camera.add(lamp);
  scene.add(camera);
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.2);
  sun.position.set(40, 80, 20);
  scene.add(sun);

  // Everything built from the hole's shape lives in one group, rebuilt when the hole changes.
  let holeGroup = new THREE.Group();
  scene.add(holeGroup);

  let hole: Hole | null = null;
  let holeKey = "";
  let gameId = -1;
  let dirty = true;

  // ---- camera ----

  /** Looking at the wall point at angle `theta` and height `y`, from `dist` metres away across the shaft. */
  const cam = { theta: Math.PI / 2, y: -FLOOR_H + EYE_HEIGHT, dist: 14 };

  function maxDist(): number {
    // Stay inside the shaft: no further back than just short of the opposite ledge.
    return hole ? hole.shaftRadiusM + openShaftRadius(hole) - 0.5 : 14;
  }

  function clampCamera(): void {
    cam.dist = Math.min(maxDist(), Math.max(MIN_DIST, cam.dist));
    const bottom = hole ? floorSpan(hole.floors + 1)[0] + EYE_HEIGHT : -FLOOR_H;
    cam.y = Math.min(FLOOR_H * 3, Math.max(bottom, cam.y));
  }

  function applyCamera(): void {
    clampCamera();
    const R = hole?.shaftRadiusM ?? 10;
    const out = new THREE.Vector3(Math.cos(cam.theta), 0, Math.sin(cam.theta));
    // Above the surface, tip the view down into the hole.
    const target = out.clone().multiplyScalar(R).setY(cam.y - 0.3 - Math.max(0, cam.y) * 2);
    camera.position.copy(target).addScaledVector(out, -cam.dist).setY(cam.y);
    camera.lookAt(target);
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

  /** A curved vertical face at radius r between two angles and two heights, facing the axis. */
  function wallFace(r: number, a0: number, a1: number, y0: number, y1: number): THREE.BufferGeometry {
    const pos: number[] = [];
    for (let i = 0; i < ARC_STEPS; i++) {
      const b0 = a0 + ((a1 - a0) * i) / ARC_STEPS;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / ARC_STEPS;
      const p = (a: number, y: number) => [r * Math.cos(a), y, r * Math.sin(a)];
      pos.push(...p(b0, y0), ...p(b1, y0), ...p(b1, y1), ...p(b0, y0), ...p(b1, y1), ...p(b0, y1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  function buildHole(h: Hole): void {
    scene.remove(holeGroup);
    dispose(holeGroup);
    holeGroup = new THREE.Group();

    const R = h.shaftRadiusM;
    const rOpen = openShaftRadius(h);
    const n1 = h.ringSlots[0]!;
    const rock = new THREE.MeshStandardMaterial({ color: C.rock, roughness: 0.95, side: THREE.DoubleSide });
    const rockDark = new THREE.MeshStandardMaterial({ color: C.rockDark, roughness: 1, side: THREE.DoubleSide });
    const ledge = new THREE.MeshStandardMaterial({ color: C.ledge, roughness: 0.8 });
    const rail = new THREE.MeshStandardMaterial({ color: C.rail, metalness: 0.4, roughness: 0.5 });

    // The shaft wall, one face per ring-1 slot per floor, so rooms can replace them later.
    for (let floor = 1; floor <= h.floors; floor++) {
      const [y0, y1] = floorSpan(floor);
      for (let slot = 0; slot < n1; slot++) {
        const [a0, a1] = slotAngles(slot, n1);
        holeGroup.add(new THREE.Mesh(wallFace(R, a0, a1, y0, y1), rock));
      }

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

    // The floor being dug: rock walls around, rough rock underfoot.
    const [dy0, dy1] = floorSpan(h.floors + 1);
    for (let slot = 0; slot < n1; slot++) {
      const [a0, a1] = slotAngles(slot, n1);
      holeGroup.add(new THREE.Mesh(wallFace(R, a0, a1, dy0, dy1), rockDark));
    }
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R, 64), rockDark);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = dy0;
    holeGroup.add(bottom);

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
    hemi.intensity = 0.55 + 0.6 * light;
    sun.intensity = 0.2 + 1.2 * light;
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
    // Grab the wall: dragging left turns you right, dragging up takes you down.
    cam.theta += dx * 0.005;
    cam.y += dy * 0.05;
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
    if (e.ctrlKey) cam.dist *= Math.exp(e.deltaY * 0.01);
    else if (e.shiftKey) cam.theta += e.deltaY * 0.003;
    else {
      cam.theta += e.deltaX * 0.003;
      cam.y -= e.deltaY * 0.03;
    }
    applyCamera();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

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

  applyCamera();

  return {
    update(snapshot) {
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
      dispose(scene);
      renderer.dispose();
      canvas.remove();
    },
  };
}
