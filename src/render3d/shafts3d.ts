import * as THREE from "three";

// Light shafts: sunlight falling down the open shaft around midday, caught
// in the dust. A soft column of light, brightest where you look through the
// most of it, fading with depth, with faint streaks drifting down it. It
// leans a little toward the sun, and a dust storm smothers it.

const SHAFT = {
  /** The column's radius as a share of the open shaft's, and how far it leans toward the sun at most (radians). */
  radius: 0.62,
  lean: 0.22,
  /** How bright at full, its colour, and how quickly it fades going down (per metre). */
  strength: 0.18,
  color: 0xffd9a8,
  fade: 0.045,
  /** It fades in over this many metres below the rim, so its open top never shows as a ring over the hole (T-102). */
  top: 8,
  /** The sun must be at least this high (sin of its elevation) for any to reach down; full from `full`. */
  from: 0.35,
  full: 0.85,
};

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDown;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vDown = -position.y;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  uniform float fade;
  uniform float time;
  uniform float columnLength;
  uniform float top;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDown;
  void main() {
    vec3 toCam = normalize(cameraPosition - vWorld);
    // Through the middle of the column there's the most light to see; its edges fade out.
    float through = pow(abs(dot(normalize(vNormal), toCam)), 1.6);
    // Fading in below the rim (leaning lifts one side of its top above the ground), fading down
    // the hole, and gone before the column's end, so it has no hard rim at either end.
    float depth = smoothstep(0.0, top, vDown) * exp(-vDown * fade) * (1.0 - smoothstep(columnLength * 0.55, columnLength, vDown));
    // Faint streaks drifting down.
    float a = atan(vWorld.z, vWorld.x);
    float streaks = 0.75 + 0.25 * sin(a * 23.0 + vDown * 0.35 - time * 0.6) * sin(a * 7.0 - time * 0.23);
    float k = strength * through * depth * streaks;
    // Additive blending scales by alpha: the colour goes in whole.
    gl_FragColor = vec4(color, k);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class LightShaft {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private depth = 1;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(SHAFT.color) },
        strength: { value: 0 },
        fade: { value: SHAFT.fade },
        time: { value: 0 },
        columnLength: { value: 1 },
        top: { value: SHAFT.top },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), this.material);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /** Fit the column to the shaft: its open radius, and how deep the hole goes (metres below the surface). */
  fit(openRadius: number, depth: number): void {
    if (depth === this.depth && this.mesh.scale.x === openRadius * SHAFT.radius) return;
    this.depth = depth;
    // A unit cylinder, stretched: its top at the surface, running down the hole.
    this.mesh.geometry.dispose();
    const g = new THREE.CylinderGeometry(openRadius * SHAFT.radius, openRadius * SHAFT.radius, depth, 48, 1, true);
    g.translate(0, -depth / 2, 0);
    this.mesh.geometry = g;
    this.material.uniforms.columnLength!.value = depth;
  }

  /**
   * The sun's direction (unit, y up), how dusty the air is (0 clear to 1 a
   * full storm), and whether it can be seen at all.
   */
  update(sun: THREE.Vector3, storm: number, shown: boolean): void {
    const high = THREE.MathUtils.smoothstep(sun.y, SHAFT.from, SHAFT.full);
    const k = SHAFT.strength * high * (1 - storm);
    this.material.uniforms.strength!.value = k;
    this.mesh.visible = shown && k > 0.001;
    // Lean away from the sun, as the light does, a little.
    const lean = Math.min(SHAFT.lean, Math.acos(Math.min(1, sun.y)));
    const away = Math.atan2(-sun.z, -sun.x);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateOnWorldAxis(new THREE.Vector3(-Math.sin(away), 0, Math.cos(away)), -lean);
  }

  /** Let the streaks drift. */
  step(dt: number): void {
    this.material.uniforms.time!.value += dt;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
