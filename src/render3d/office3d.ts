import * as THREE from "three";
import { config } from "../sim/config";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import { itemDef } from "../view/furniture";
import { office, type OfficeLook } from "../view/officeScene";
import { disposeFurniture, furnitureMeshes } from "./furniture3d";
import { finishMaterial, isFlooringLook, withFlooring } from "./surfaces";

// The office scene: a still 3D room drawn over the hole while the office panel is open (what's in
// it: view/officeScene.ts and data/office.json). It's built from the colony's own pieces: the
// furniture meshes and materials the rooms use, and the wall and floor finishes the admin office is
// lined with. A renderer of its own, one fixed camera at eye level (first person), and a frame drawn only when something changes
// (the pieces, or the size of the view), so it costs nothing while it's up.

/**
 * Where the room stands in the world. The wall patterns (surfaces.ts) are laid out round the hole's
 * axis, so the room sits out along +x like any ring room, its back wall facing the axis, a floor down.
 */
const SITE = { radius: 60, y: -(config.geometry.surfaceDepthM + config.geometry.floorHeightM) };
/** How far the key light's shadows reach from the middle of the room, metres. */
const SHADOW = { box: 11, near: 1, far: 40, bias: -0.0006, normalBias: 0.04 };

export interface OfficeScene {
  /** Show this office: its walls and floor, and everything standing in it. */
  set(look: OfficeLook): void;
  destroy(): void;
}

/** The room's back and side walls, floor and ceiling as planes facing in, in the room's frame, running on past the camera. */
function shell(material: THREE.Material): THREE.Group {
  const { width: w, depth, height: h, front } = office.room;
  // From the back wall to `front`: how long the floor and side walls are, and where their middle is.
  const d = front + depth / 2;
  const mid = (front - depth / 2) / 2;
  const group = new THREE.Group();
  const add = (geo: THREE.PlaneGeometry, at: [number, number, number], rot: [number, number, number]): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...at);
    mesh.rotation.set(...rot);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(new THREE.PlaneGeometry(w, d), [0, 0, mid], [-Math.PI / 2, 0, 0]);
  add(new THREE.PlaneGeometry(w, d), [0, h, mid], [Math.PI / 2, 0, 0]);
  add(new THREE.PlaneGeometry(w, h), [0, h / 2, -depth / 2], [0, 0, 0]);
  add(new THREE.PlaneGeometry(d, h), [-w / 2, h / 2, mid], [0, Math.PI / 2, 0]);
  add(new THREE.PlaneGeometry(d, h), [w / 2, h / 2, mid], [0, -Math.PI / 2, 0]);
  return group;
}

/** Throws if the browser can't give a WebGL context. */
export function createOfficeScene(host: HTMLElement): OfficeScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = office.lights.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(office.lights.background);
  const L = office.lights;
  scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.fill), new THREE.AmbientLight(L.sky, L.ambient));

  // Everything is placed in the room's own frame (data/office.json), and the room is stood at its site.
  const room = new THREE.Group();
  room.position.set(SITE.radius, SITE.y, 0);
  room.rotation.y = -Math.PI / 2;
  scene.add(room);

  const key = new THREE.DirectionalLight(L.key.color, L.key.strength);
  key.position.set(...L.key.at);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(L.key.shadowMap, L.key.shadowMap);
  key.shadow.bias = SHADOW.bias;
  key.shadow.normalBias = SHADOW.normalBias;
  Object.assign(key.shadow.camera, { left: -SHADOW.box, right: SHADOW.box, top: SHADOW.box, bottom: -SHADOW.box, near: SHADOW.near, far: SHADOW.far });
  room.add(key, key.target);
  room.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(office.camera.fov, office.camera.aspect, 0.1, 200);
  camera.position.copy(room.localToWorld(new THREE.Vector3(...office.camera.at)));
  camera.lookAt(room.localToWorld(new THREE.Vector3(...office.camera.look)));
  /** Half the width in frame, as a tangent: kept when the view is narrower than the camera was framed for. */
  const halfWidth = Math.tan((office.camera.fov * Math.PI) / 360) * office.camera.aspect;

  /** What's drawn now: the shell (with its own material) and the furniture with its lamps. */
  let built: { key: string; walls: THREE.Group; material: THREE.Material; items: THREE.Group; lamps: THREE.PointLight[] } | null = null;

  const render = (): void => renderer.render(scene, camera);

  const clear = (): void => {
    if (!built) return;
    room.remove(built.walls, built.items, ...built.lamps);
    built.walls.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
    built.material.dispose();
    disposeFurniture(built.items);
    built.lamps.forEach((l) => l.dispose());
    built = null;
  };

  const resize = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = Math.max(1, host.clientHeight);
    if (!w) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect >= office.camera.aspect ? office.camera.fov : Math.min(office.camera.maxFov, (Math.atan(halfWidth / camera.aspect) * 360) / Math.PI);
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(host);

  return {
    set(look) {
      if (built?.key === look.key) return;
      clear();
      const material = isFlooringLook(look.flooring ?? undefined) ? withFlooring(finishMaterial(look.finish), look.flooring as "fibre_panels", 0) : finishMaterial(look.finish);
      const walls = shell(material);
      const items = furnitureMeshes(look.items, cssColor(CATEGORY_COLORS.admin!));
      items.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      // Lamps, fires and screens that give light (furniture `light`) each light the room around them.
      const lamps: THREE.PointLight[] = [];
      for (const p of look.items) {
        const light = itemDef(p.item).light;
        if (!light) continue;
        const lamp = new THREE.PointLight(light.color, light.strength * L.lamps.strength, light.reach * L.lamps.reach, 2);
        lamp.position.set(...light.at).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.turn).add(new THREE.Vector3(p.x, p.y, p.z));
        lamps.push(lamp);
      }
      room.add(walls, items, ...lamps);
      built = { key: look.key, walls, material, items, lamps };
      render();
    },
    destroy() {
      resize.disconnect();
      clear();
      key.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    },
  };
}
