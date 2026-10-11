import * as THREE from "three";

// The hot drink in first person (T-139): an arm low on the right holding a
// mug of something dark and steaming, carried on the camera like a tool in
// other first-person games. It bobs as you walk. Purely the view's: nothing
// goes to the sim, and it's gone once you leave first person.

/** Where it sits in the camera's frame (metres; the camera looks down −z), how it bobs, and its steam. */
const HOLD = { at: [0.091, -0.07, -0.294] as const, scale: 0.7, tip: 0.35, bobUp: 0.012, bobSide: 0.008, stride: 1.6, puffs: 6, rise: 0.16, puffLife: 1.6 };
const COLOR = { sleeve: "#c8643c", cuff: "#8a3f24", glove: "#d9c7a8", mug: "#efe6d6", band: "#c8643c", drink: "#3b2416", steam: "#f4efe8" };

export interface Drink {
  group: THREE.Group;
  /** Held or not. */
  held: boolean;
  setHeld(on: boolean): void;
  /** Move the steam on, and bob by how far the walker went (metres) since the last step. */
  step(dt: number, walked: number): void;
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
  const part = (geometry: THREE.BufferGeometry, color: string, at: [number, number, number], turn: [number, number, number] = [0, 0, 0], basic = false): THREE.Mesh => {
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
    hold.add(mesh);
    return mesh;
  };
  const hold = new THREE.Group();
  hold.position.set(...HOLD.at);
  hold.scale.setScalar(HOLD.scale);
  // Tipped toward you a little, so you see the drink in it.
  hold.rotation.x = HOLD.tip;
  group.add(hold);

  // The arm comes up from below right, toward the far side, to the hand on the handle.
  const hand: [number, number, number] = [0.066, -0.004, 0.008];
  const arm = new THREE.Vector3(-0.4, 0.6, -0.7).normalize();
  const back = (d: number): [number, number, number] => [hand[0] - arm.x * d, hand[1] - arm.y * d, hand[2] - arm.z * d];
  const up = new THREE.Vector3(0, 1, 0);
  part(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 12), COLOR.sleeve, back(0.24)).quaternion.setFromUnitVectors(up, arm);
  part(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 12), COLOR.cuff, back(0.045)).quaternion.setFromUnitVectors(up, arm);
  // The mug: cream, with a band of colour, a handle toward the hand, and dark coffee near the brim.
  part(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 18), COLOR.mug, [0, 0, 0]);
  part(new THREE.CylinderGeometry(0.0425, 0.0425, 0.014, 18, 1, true), COLOR.band, [0, -0.014, 0]);
  part(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18), COLOR.drink, [0, 0.0485, 0]);
  part(new THREE.TorusGeometry(0.024, 0.008, 8, 14, Math.PI * 1.3), COLOR.mug, [0.043, 0.002, 0], [0, 0, -Math.PI * 0.65]);
  // Fingers round the handle, in front of it.
  part(new THREE.SphereGeometry(0.026, 12, 10), COLOR.glove, hand).scale.set(0.9, 1.25, 0.9);
  // Steam: a few soft puffs rising off the top and fading.
  const puff = new THREE.SphereGeometry(0.008, 8, 6);
  const puffs = Array.from({ length: HOLD.puffs }, (_, i) => ({ mesh: part(puff, COLOR.steam, [0, 0.05, 0], undefined, true), age: (i / HOLD.puffs) * HOLD.puffLife, sway: i * 1.7 }));

  camera.add(group);
  let stride = 0;

  return {
    group,
    held: false,
    setHeld(on) {
      this.held = on;
      group.visible = on;
    },
    step(dt, walked) {
      if (!this.held) return;
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
