import * as THREE from "three";

// The hot drink in first person (T-139): an arm low on the right holding a
// mug of something dark and steaming, carried on the camera like a tool in
// other first-person games. It bobs as you walk. Purely the view's: nothing
// goes to the sim, and it's gone once you leave first person.

/** Where it sits in the camera's frame (metres; the camera looks down −z), how it bobs, and its steam. */
const HOLD = { at: [0.091, -0.07, -0.294] as const, scale: 0.7, bobUp: 0.012, bobSide: 0.008, stride: 1.6, puffs: 6, rise: 0.16, puffLife: 1.6 };
const COLOR = { sleeve: "#c8643c", cuff: "#8a3f24", glove: "#d9c7a8", mug: "#efe6d6", band: "#c8643c", drink: "#3b2416", steam: "#f4efe8" };

export interface Drink {
  group: THREE.Group;
  /** Held or not. */
  held: boolean;
  setHeld(on: boolean): void;
  /** Move the steam on, bob by how far the walker went (metres) since the last step, and keep the mug level as the head tilts (`pitch`, radians, up positive). */
  step(dt: number, walked: number, pitch: number): void;
  dispose(): void;
}

// Lit by its own soft light from above left, not the scene's: the headlamp is right beside it, and would burn it white.
let matcap: THREE.CanvasTexture | null = null;
function shading(): THREE.Texture {
  if (matcap) return matcap;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const light = ctx.createRadialGradient(size * 0.36, size * 0.3, size * 0.04, size * 0.5, size * 0.5, size * 0.52);
  light.addColorStop(0, "#ffffff");
  light.addColorStop(0.5, "#e2dbd3");
  light.addColorStop(1, "#8a8078");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  matcap = new THREE.CanvasTexture(canvas);
  matcap.colorSpace = THREE.SRGBColorSpace;
  return matcap;
}

export function createDrink(camera: THREE.Camera): Drink {
  const group = new THREE.Group();
  group.visible = false;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let order = 1000;
  // Drawn last. Held close (a walker keeps further than that from walls), and scaled down to look the same size, so it doesn't sink into a wall you walk up to.
  const part = (on: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, at: [number, number, number], turn: [number, number, number] = [0, 0, 0], basic = false): THREE.Mesh => {
    const material = basic
      ? new THREE.MeshBasicMaterial({ color, depthWrite: false, transparent: true, opacity: 0 })
      : new THREE.MeshMatcapMaterial({ color, matcap: shading() });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.rotation.set(...turn);
    mesh.renderOrder = order++;
    // Not something to point at.
    mesh.raycast = () => {};
    geometries.push(geometry);
    materials.push(material);
    on.add(mesh);
    return mesh;
  };
  const hold = new THREE.Group();
  hold.position.set(...HOLD.at);
  hold.scale.setScalar(HOLD.scale);
  group.add(hold);
  // The mug turns against the head's tilt, so its top stays level with the floor and nothing spills.
  const mug = new THREE.Group();
  hold.add(mug);

  // The mug: cream, with a band of colour, a handle toward the hand, and dark coffee near the brim.
  part(mug, new THREE.CylinderGeometry(0.042, 0.038, 0.095, 18), COLOR.mug, [0, 0, 0]);
  part(mug, new THREE.CylinderGeometry(0.0425, 0.0425, 0.014, 18, 1, true), COLOR.band, [0, -0.014, 0]);
  part(mug, new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18), COLOR.drink, [0, 0.0485, 0]);
  part(mug, new THREE.TorusGeometry(0.024, 0.008, 8, 14, Math.PI * 1.3), COLOR.mug, [0.043, 0.002, 0], [0, 0, -Math.PI * 0.65]);
  // Fingers round the handle, in front of it: they turn with the mug.
  const grip: [number, number, number] = [0.066, -0.004, 0.008];
  part(mug, new THREE.SphereGeometry(0.026, 12, 10), COLOR.glove, grip).scale.set(0.9, 1.25, 0.9);
  // The arm comes up from a shoulder below right to wherever the hand is, its wrist bending to keep the mug level.
  const reach = new THREE.Vector3(-0.4, 0.6, -0.7).normalize();
  const shoulder = new THREE.Vector3(...grip).addScaledVector(reach, -0.44);
  const sleeve = part(hold, new THREE.CylinderGeometry(0.04, 0.05, 1, 12), COLOR.sleeve, [0, 0, 0]);
  const cuff = part(hold, new THREE.CylinderGeometry(0.036, 0.036, 0.04, 12), COLOR.cuff, [0, 0, 0]);
  const up = new THREE.Vector3(0, 1, 0);
  const hand = new THREE.Vector3();
  const along = new THREE.Vector3();
  function bendArm(): void {
    mug.updateMatrix();
    hand.set(...grip).applyMatrix4(mug.matrix);
    along.subVectors(hand, shoulder);
    const length = along.length();
    along.divideScalar(length);
    // The sleeve stops short of the hand, where the cuff is.
    sleeve.position.copy(shoulder).addScaledVector(along, (length - 0.04) / 2);
    sleeve.scale.set(1, length - 0.04, 1);
    sleeve.quaternion.setFromUnitVectors(up, along);
    cuff.position.copy(hand).addScaledVector(along, -0.045);
    cuff.quaternion.setFromUnitVectors(up, along);
  }
  bendArm();
  // Steam: a few soft puffs rising off the top and fading.
  const puff = new THREE.SphereGeometry(0.008, 8, 6);
  const puffs = Array.from({ length: HOLD.puffs }, (_, i) => ({ mesh: part(mug, puff, COLOR.steam, [0, 0.05, 0], undefined, true), age: (i / HOLD.puffs) * HOLD.puffLife, sway: i * 1.7 }));

  camera.add(group);
  let stride = 0;

  return {
    group,
    held: false,
    setHeld(on) {
      this.held = on;
      group.visible = on;
    },
    step(dt, walked, pitch) {
      if (!this.held) return;
      mug.rotation.x = -pitch;
      bendArm();
      stride += walked;
      const phase = (stride / HOLD.stride) * Math.PI * 2;
      group.position.set(Math.cos(phase / 2) * HOLD.bobSide, -Math.abs(Math.sin(phase / 2)) * HOLD.bobUp, 0);
      for (const p of puffs) {
        p.age = (p.age + dt) % HOLD.puffLife;
        const t = p.age / HOLD.puffLife;
        p.mesh.position.set(Math.sin(t * 5 + p.sway) * 0.012, 0.05 + t * HOLD.rise, Math.cos(t * 4 + p.sway) * 0.008);
        p.mesh.scale.setScalar(0.6 + t * 1.2);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.22 * Math.sin(t * Math.PI);
      }
    },
    dispose() {
      camera.remove(group);
      for (const g of new Set(geometries)) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
