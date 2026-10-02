import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { HorizontalTiltShiftShader } from "three/examples/jsm/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/examples/jsm/shaders/VerticalTiltShiftShader.js";
import { hasPostEffects, type Graphics } from "../view/graphics";

// The 3D view's look: what's drawn after the scene, scaled by the graphics
// settings. The scene renders once (antialiased, with its depth kept), then:
// ambient occlusion from that depth, a warm haze by distance and depth, glow
// around bright things, a tilt-shift blur in Iso, tone mapping, and a final
// warm grade with a vignette. It reads the scene's own depth rather than
// re-rendering it, so walls lowered by "walls down" cast no shade. With every
// effect off, the scene renders straight to the screen, as before.

/** Tuning, in metres where it's a distance. */
const LOOK = {
  /** Ambient occlusion: how far it reaches, and how dark at full strength. */
  ao: { radius: 2.5, scale: 1.8, thickness: 2, distanceExponent: 1.5 },
  /** Glow: strength and spread at full, and how bright a pixel must be to glow (linear, before tone mapping). */
  bloom: { strength: 0.45, radius: 0.5, threshold: 1.0 },
  /**
   * Haze: its colour; how it thickens below the floor in view (per metre); how it
   * thickens with distance past a clear range, from inside the hole; and the most it hides.
   */
  haze: { color: 0x5e3a2c, depthDensity: 0.035, clear: 15, density: 0.012, max: 0.6 },
  /**
   * Mood by depth and hour: near the surface things take the time of day (a
   * moonlit blue at night); deeper down, lamps take over, whatever the hour,
   * and everything settles into their amber. `deep` is how far down (metres
   * below the surface) the lamps have taken over entirely; `from` is where the change starts.
   */
  /** A dust storm: haze turns dusty and thick, and reaches far things from anywhere. */
  storm: { color: 0x8a5838, density: 0.05, clear: 4, max: 0.88 },
  mood: { night: [0.72, 0.8, 1.02] as const, lamp: [1.07, 0.93, 0.78] as const, from: 2, deep: 22 },
  /** Tilt-shift: blur at full (as a share of the screen), and where the sharp band sits (0 bottom, 1 top). */
  tiltShift: { blur: 2.4, focus: 0.5 },
  /** The lamp-lit cave reflected by shiny floors, metal and glass. */
  environment: 0.55,
};

/** Renders the scene into its own target, keeping its depth for later passes, then hands the colour on. */
class ScenePass extends Pass {
  readonly target: THREE.WebGLRenderTarget;
  private copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms) }));

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {
    super();
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture });
  }

  setSize(w: number, h: number): void {
    this.target.setSize(w, h);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    const m = this.copy.material as THREE.ShaderMaterial;
    m.uniforms.tDiffuse!.value = this.target.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.render(renderer);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.copy.material.dispose();
    this.copy.dispose();
  }
}

/**
 * Ambient occlusion from the scene's own depth (normals are worked out from it).
 * GTAOPass still makes, and sizes, its own normals target even when it's given
 * a depth texture, and reads it when given one at construction; it's made and
 * then kept at one pixel, as it's never drawn into.
 */
class SceneAOPass extends GTAOPass {
  setSize(w: number, h: number): void {
    super.setSize(w, h);
    (this as unknown as { normalRenderTarget: THREE.WebGLRenderTarget }).normalRenderTarget.setSize(1, 1);
  }
}

/**
 * Warm haze from the scene's depth: floors below the one in view fade into it,
 * the further down the more, and from inside the hole (walking, the shaft) so
 * do far-off things. The sky is left clear.
 */
const HazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    projectionInverse: { value: new THREE.Matrix4() },
    cameraWorld: { value: new THREE.Matrix4() },
    color: { value: new THREE.Color(LOOK.haze.color) },
    density: { value: LOOK.haze.density },
    clear: { value: LOOK.haze.clear },
    depthDensity: { value: LOOK.haze.depthDensity },
    focusY: { value: 0 },
    byDistance: { value: 0 },
    amount: { value: 1 },
    most: { value: LOOK.haze.max },
    daylight: { value: 1 },
    nightTint: { value: new THREE.Vector3(...LOOK.mood.night) },
    lampTint: { value: new THREE.Vector3(...LOOK.mood.lamp) },
    moodFrom: { value: LOOK.mood.from },
    moodDeep: { value: LOOK.mood.deep },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 projectionInverse;
    uniform mat4 cameraWorld;
    uniform vec3 color;
    uniform float density;
    uniform float clear;
    uniform float depthDensity;
    uniform float focusY;
    uniform float byDistance;
    uniform float amount;
    uniform float most;
    uniform float daylight;
    uniform vec3 nightTint;
    uniform vec3 lampTint;
    uniform float moodFrom;
    uniform float moodDeep;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float z = texture2D(tDepth, vUv).x;
      if (z >= 1.0) { gl_FragColor = base; return; }
      // Back to a point in the world: its distance from the camera, and how far below the surface.
      vec4 view = projectionInverse * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      view /= view.w;
      vec3 world = (cameraWorld * view).xyz;
      float below = max(0.0, focusY - world.y);
      float far = max(0.0, length(view.xyz) - clear) * byDistance;
      float f = (1.0 - exp(-below * depthDensity - far * density)) * amount;
      vec3 c = mix(base.rgb, color, clamp(f, 0.0, most));
      // The mood: the hour's light near the surface, the lamps' deeper down.
      float lamps = smoothstep(moodFrom, moodDeep, -world.y);
      vec3 tint = mix(mix(nightTint, vec3(1.0), daylight), lampTint, lamps);
      gl_FragColor = vec4(c * mix(vec3(1.0), tint, amount), base.a);
    }`,
};

/** The last step, on screen colours: warm shadows, creamy highlights, a little more colour, and a soft vignette. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 1 } },
  vertexShader: HazeShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 c = base.rgb;
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      // Split toning: plum-brown in the shadows, apricot cream in the highlights.
      vec3 toned = c + mix(vec3(0.035, 0.0, 0.02), vec3(0.04, 0.02, -0.03), smoothstep(0.2, 0.8, luma));
      // A touch more saturation, and a gentle S-curve.
      toned = mix(vec3(luma), toned, 1.12);
      toned = mix(toned, toned * toned * (3.0 - 2.0 * toned), 0.25);
      // Vignette: the corners settle into shadow.
      vec2 d = vUv - 0.5;
      toned *= 1.0 - smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0))) * 0.35;
      gl_FragColor = vec4(mix(c, toned, amount), base.a);
    }`,
};

/** What the stage needs from the post-processing pipeline (Look, or PlainLook while trying WebGPU). */
export interface LookLike {
  setGraphics(g: Graphics): void;
  setStorm(level: number): void;
  setDaylight(light: number): void;
  setView(focusY: number, inside: boolean, iso: boolean): void;
  resize(): void;
  render(): void;
  dispose(): void;
}

/** No post effects at all: the scene straight to the screen (the WebGPU experiment, until its own pipeline exists). */
export class PlainLook implements LookLike {
  constructor(
    private renderer: { render(s: THREE.Scene, c: THREE.Camera): unknown; setPixelRatio(r: number): void },
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {}
  setGraphics(g: Graphics): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, g.pixelRatio));
  }
  setStorm(): void {}
  setDaylight(): void {}
  setView(): void {}
  resize(): void {}
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {}
}

/**
 * What shiny things reflect: not a photo studio but the inside of the hole. Dark warm rock all round,
 * darker underfoot, a string of warm lamps along the walls at head height, and a pale patch of sky
 * overhead where the shaft opens. Blurred into the environment map, it reads as warm glints and a
 * cool sheen from above.
 */
function caveEnvironment(): THREE.Scene {
  const scene = new THREE.Scene();
  const basic = (color: number, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), [basic(0x3a2418), basic(0x3a2418), basic(0x1c1410), basic(0x24150e), basic(0x3a2418), basic(0x3a2418)]);
  room.position.y = 3;
  scene.add(room);
  // Lamps along the walls.
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc48a).multiplyScalar(6) });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), lamp);
    m.position.set(Math.cos(a) * 9.3, 3.5, Math.sin(a) * 9.3);
    scene.add(m);
  }
  // The sky down the shaft.
  const sky = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc9b8a8).multiplyScalar(2) }));
  sky.rotation.x = Math.PI / 2;
  sky.position.y = 7.9;
  scene.add(sky);
  return scene;
}

export class Look implements LookLike {
  private graphics: Graphics | null = null;
  private iso = false;
  private storm = 0;
  private composer: EffectComposer;
  private scenePass: ScenePass;
  private ao: SceneAOPass;
  private haze: ShaderPass;
  private bloom: UnrealBloomPass;
  private tiltH: ShaderPass;
  private tiltV: ShaderPass;
  private grade: ShaderPass;
  private envTexture: THREE.Texture | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.scenePass = new ScenePass(scene, camera);
    this.ao = new SceneAOPass(scene, camera, 1, 1);
    this.ao.setGBuffer(this.scenePass.target.depthTexture!);
    this.ao.updateGtaoMaterial(LOOK.ao);
    this.haze = new ShaderPass(HazeShader);
    this.haze.uniforms.tDepth!.value = this.scenePass.target.depthTexture;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
    this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
    this.tiltV = new ShaderPass(VerticalTiltShiftShader);
    this.tiltH.uniforms.r!.value = LOOK.tiltShift.focus;
    this.tiltV.uniforms.r!.value = LOOK.tiltShift.focus;
    this.grade = new ShaderPass(GradeShader);
    for (const p of [this.scenePass, this.ao, this.haze, this.bloom, this.tiltH, this.tiltV, new OutputPass(), this.grade]) this.composer.addPass(p);
  }

  /** Apply graphics settings: which effects run and how strongly, the resolution, and reflections. */
  setGraphics(g: Graphics): void {
    this.graphics = g;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, g.pixelRatio));
    this.ao.enabled = g.ao > 0;
    this.ao.blendIntensity = g.ao;
    this.haze.enabled = g.haze > 0;
    this.haze.uniforms.amount!.value = g.haze;
    this.bloom.enabled = g.bloom > 0;
    this.bloom.strength = LOOK.bloom.strength * g.bloom;
    this.grade.enabled = g.grade > 0;
    this.grade.uniforms.amount!.value = g.grade;
    // Reflections: a warm, lamp-lit cave, made once.
    if (g.reflections && !this.envTexture) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const cave = caveEnvironment();
      this.envTexture = pmrem.fromScene(cave, 0.04).texture;
      cave.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = m.material as THREE.Material | THREE.Material[] | undefined;
        for (const mat of Array.isArray(mats) ? mats : mats ? [mats] : []) mat.dispose();
      });
      pmrem.dispose();
    }
    this.scene.environment = g.reflections ? this.envTexture : null;
    this.scene.environmentIntensity = LOOK.environment;
    this.applyTiltShift();
    this.resize();
  }

  /**
   * Where the view is: the height of the floor in view (what's below it hazes
   * over), whether it's from inside the hole (far things haze too), and whether
   * it's Iso (the only view tilt-shift suits).
   */
  /** How hard a dust storm is blowing, 0 to 1: the haze thickens and browns, near and far. */
  setStorm(level: number): void {
    this.storm = level;
    const u = this.haze.uniforms;
    (u.color!.value as THREE.Color).set(LOOK.haze.color).lerp(new THREE.Color(LOOK.storm.color), level);
    u.density!.value = LOOK.haze.density + (LOOK.storm.density - LOOK.haze.density) * level;
    u.clear!.value = LOOK.haze.clear + (LOOK.storm.clear - LOOK.haze.clear) * level;
    u.most!.value = LOOK.haze.max + (LOOK.storm.max - LOOK.haze.max) * level;
  }

  /** Daylight, 0 (night) to 1 (noon), for the mood near the surface. */
  setDaylight(light: number): void {
    this.haze.uniforms.daylight!.value = light;
  }

  setView(focusY: number, inside: boolean, iso: boolean): void {
    this.haze.uniforms.focusY!.value = focusY;
    this.haze.uniforms.byDistance!.value = Math.max(inside ? 1 : 0, this.storm);
    if (iso === this.iso) return;
    this.iso = iso;
    this.applyTiltShift();
  }

  private applyTiltShift(): void {
    const t = this.graphics?.tiltShift ?? 0;
    const on = this.iso && t > 0;
    this.tiltH.enabled = on;
    this.tiltV.enabled = on;
    this.setTiltSize();
  }

  private setTiltSize(): void {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const t = (this.graphics?.tiltShift ?? 0) * LOOK.tiltShift.blur;
    this.tiltH.uniforms.h!.value = t / Math.max(1, size.x);
    this.tiltV.uniforms.v!.value = t / Math.max(1, size.y);
  }

  /** Match the canvas: call after the renderer's size or pixel ratio changes. */
  resize(): void {
    const css = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(css.x, css.y);
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.scenePass.setSize(px.x, px.y);
    this.setTiltSize();
  }

  render(): void {
    if (!this.graphics || !hasPostEffects(this.graphics)) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const u = this.haze.uniforms;
    u.projectionInverse!.value.copy(this.camera.projectionMatrixInverse);
    u.cameraWorld!.value.copy(this.camera.matrixWorld);
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.scenePass.dispose();
    this.ao.dispose();
    this.bloom.dispose();
    this.envTexture?.dispose();
  }
}
