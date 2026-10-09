import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

// Tilt-shift for Free view: the colony as a miniature. A depth of field rather
// than a band across the screen, so it stays right as the camera tilts: what
// sits about as far from the camera as the floor in view stays sharp, and
// things nearer or farther blur the more the farther they are from it. The blur
// is made small and cheap: the picture is blurred once at half size and again at
// quarter size, and each pixel mixes from sharp to the half blur to the quarter
// blur by how far it is from the focus. A touch more colour goes with it.

/** Tuning. Distances are shares of the focus distance or of the hole's radius. */
const TILT = {
  /** How much of the hole's outer radius, either side of the focus, stays fully sharp. */
  band: 0.15,
  /** Past the sharp band, how far (as a share of the focus distance) until the blur is full. */
  ramp: 0.3,
  /** Blur spread in texels of each level; the quarter-size level's texels are twice the half's. */
  spread: 1.6,
  /** Extra saturation at full strength. */
  saturation: 0.18,
};

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A 9-tap Gaussian blur along one direction (in texels of the source). */
const BlurShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, step: { value: new THREE.Vector2() } },
  vertexShader: quadVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 step;
    varying vec2 vUv;
    void main() {
      vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
      sum += (texture2D(tDiffuse, vUv + step * 1.384615) + texture2D(tDiffuse, vUv - step * 1.384615)) * 0.316216;
      sum += (texture2D(tDiffuse, vUv + step * 3.230769) + texture2D(tDiffuse, vUv - step * 3.230769)) * 0.070270;
      gl_FragColor = sum;
    }`,
};

/** Sharp to blurred by each pixel's distance from the focus, from the scene's depth. */
const MixShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tHalf: { value: null as THREE.Texture | null },
    tQuarter: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    projectionInverse: { value: new THREE.Matrix4() },
    focus: { value: 50 },
    band: { value: 20 },
    ramp: { value: 25 },
    amount: { value: 0 },
    saturation: { value: TILT.saturation },
  },
  vertexShader: quadVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tHalf;
    uniform sampler2D tQuarter;
    uniform sampler2D tDepth;
    uniform mat4 projectionInverse;
    uniform float focus;
    uniform float band;
    uniform float ramp;
    uniform float amount;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 sharp = texture2D(tDiffuse, vUv);
      float z = texture2D(tDepth, vUv).x;
      // How far from the camera (the sky counts as far off).
      vec4 view = projectionInverse * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      float d = z >= 1.0 ? 1e6 : length(view.xyz / view.w);
      float blur = smoothstep(0.0, 1.0, (abs(d - focus) - band) / ramp) * amount;
      vec3 c = blur < 0.5
        ? mix(sharp.rgb, texture2D(tHalf, vUv).rgb, blur * 2.0)
        : mix(texture2D(tHalf, vUv).rgb, texture2D(tQuarter, vUv).rgb, blur * 2.0 - 1.0);
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(mix(vec3(luma), c, 1.0 + saturation * amount), sharp.a);
    }`,
};

export class TiltShiftPass extends Pass {
  private half = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  private quarter = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  private blur = new FullScreenQuad(new THREE.ShaderMaterial({ ...BlurShader, uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms) }));
  private mix = new FullScreenQuad(new THREE.ShaderMaterial({ ...MixShader, uniforms: THREE.UniformsUtils.clone(MixShader.uniforms) }));

  constructor(
    depth: THREE.Texture,
    private camera: THREE.Camera,
  ) {
    super();
    this.mixUniforms.tDepth!.value = depth;
  }

  private get mixUniforms() {
    return (this.mix.material as THREE.ShaderMaterial).uniforms;
  }

  /** How strong, 0 (off) to 1. */
  setAmount(amount: number): void {
    this.mixUniforms.amount!.value = amount;
  }

  /** Where to focus: the distance from the camera to what it orbits, and the hole's outer radius (both in metres). */
  setFocus(distance: number, radius: number): void {
    const u = this.mixUniforms;
    u.focus!.value = distance;
    u.band!.value = radius * TILT.band;
    u.ramp!.value = Math.max(1, distance * TILT.ramp);
  }

  setSize(w: number, h: number): void {
    for (const t of this.half) t.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    for (const t of this.quarter) t.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }

  private blurInto(renderer: THREE.WebGLRenderer, from: THREE.Texture, to: THREE.WebGLRenderTarget, dx: number, dy: number): void {
    const u = (this.blur.material as THREE.ShaderMaterial).uniforms;
    u.tDiffuse!.value = from;
    (u.step!.value as THREE.Vector2).set((dx * TILT.spread) / to.width, (dy * TILT.spread) / to.height);
    renderer.setRenderTarget(to);
    this.blur.render(renderer);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const [h0, h1] = this.half as [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    const [q0, q1] = this.quarter as [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    // Half size, then quarter size from that: each blurred across, then down.
    this.blurInto(renderer, readBuffer.texture, h0, 1, 0);
    this.blurInto(renderer, h0.texture, h1, 0, 1);
    this.blurInto(renderer, h1.texture, q0, 1, 0);
    this.blurInto(renderer, q0.texture, q1, 0, 1);
    const u = this.mixUniforms;
    u.tDiffuse!.value = readBuffer.texture;
    u.tHalf!.value = h1.texture;
    u.tQuarter!.value = q1.texture;
    (u.projectionInverse!.value as THREE.Matrix4).copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.mix.render(renderer);
  }

  dispose(): void {
    for (const t of [...this.half, ...this.quarter]) t.dispose();
    this.blur.material.dispose();
    this.blur.dispose();
    this.mix.material.dispose();
    this.mix.dispose();
  }
}
