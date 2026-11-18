import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { hasPostEffects, type Graphics } from "../view/graphics";
import { TiltShiftPass } from "./tiltShift";
import { LABEL_LAYER, labelDepth } from "./labelLayer";
import { applyRetroTuning, bandLighting, initRetroTuning, onRetroTuning, retroGrid, retroShader, retroTuning, snapVertices, upscaleShader, type RetroStyle } from "./lookRetro";

// The 3D view's look: what's drawn after the scene, scaled by the graphics
// settings. The scene renders once (antialiased, with its depth kept), then:
// ambient occlusion from that depth, a warm haze by distance and depth, glow
// around bright things, a tilt-shift depth of field in Free view (tiltShift.ts), tone mapping, and a final
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
  /**
   * Aerial perspective over the land (#497): the dust in the air between the camera and anything out on the
   * surface, from wherever it's seen. Clear for `clear` metres, then thickening by `density` a metre, up to
   * `max`, in the colour of the sky at the horizon (by day, and by night), and thicker in a storm (`storm`
   * times the density at full). It washes out far shadows and contrast as well as colour.
   */
  aerial: { clear: 300, density: 0.0008, max: 0.48, day: 0xd9a47c, night: 0x1c1016, storm: 3 },
  mood: { night: [0.72, 0.8, 1.02] as const, lamp: [1.07, 0.93, 0.78] as const, from: 2, deep: 22 },
  /** The lamp-lit cave reflected by shiny floors, metal and glass. */
  environment: 0.55,
};

const AERIAL_DAY = new THREE.Color(LOOK.aerial.day);
const STORM_DUST = new THREE.Color(LOOK.storm.color);

/** Renders the scene into its own target, keeping its depth for later passes, then hands the colour on. */
class ScenePass extends Pass {
  readonly target: THREE.WebGLRenderTarget;
  private copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms) }));

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    samples = 4,
  ) {
    super();
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture });
  }

  setSize(w: number, h: number): void {
    this.target.setSize(w, h);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    // Everything but the labels: they come after the blur (LabelPass).
    this.camera.layers.disable(LABEL_LAYER);
    renderer.render(this.scene, this.camera);
    this.camera.layers.enable(LABEL_LAYER);
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
 * The room labels, drawn over the picture after the tilt-shift blur so they stay
 * sharp, hidden where the scene's depth says something stands in front of them.
 */
class LabelPass extends Pass {
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private depth: THREE.Texture,
  ) {
    super();
    this.needsSwap = false;
  }

  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    this.drawTo(renderer, this.renderToScreen ? null : readBuffer, readBuffer.width, readBuffer.height);
  }

  /** Draw the labels into a target (null: the screen) of this size in pixels, which the scene's depth covers. */
  drawTo(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null, w: number, h: number): void {
    const { scene, camera } = this;
    const background = scene.background;
    const autoClear = renderer.autoClear;
    const mask = camera.layers.mask;
    scene.background = null;
    renderer.autoClear = false;
    camera.layers.set(LABEL_LAYER);
    labelDepth.tSceneDepth.value = this.depth;
    labelDepth.sceneDepthOn.value = 1;
    labelDepth.sceneSize.value.set(w, h);
    if (camera instanceof THREE.PerspectiveCamera) {
      labelDepth.cameraNear.value = camera.near;
      labelDepth.cameraFar.value = camera.far;
    }
    renderer.setRenderTarget(target);
    // The buffer's own depth holds only the full-screen passes'; the scene's depth texture decides instead.
    renderer.clearDepth();
    renderer.render(scene, camera);
    labelDepth.sceneDepthOn.value = 0;
    camera.layers.mask = mask;
    renderer.autoClear = autoClear;
    scene.background = background;
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
    aerialColor: { value: new THREE.Color(LOOK.aerial.day) },
    aerialDensity: { value: LOOK.aerial.density },
    aerialClear: { value: LOOK.aerial.clear },
    aerialMost: { value: LOOK.aerial.max },
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
    uniform vec3 aerialColor;
    uniform float aerialDensity;
    uniform float aerialClear;
    uniform float aerialMost;
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
      // The dust in the air over the land, out on the surface (#497).
      float aerial = (1.0 - exp(-max(0.0, length(view.xyz) - aerialClear) * aerialDensity)) * aerialMost * smoothstep(-6.0, 0.0, world.y) * amount;
      vec3 c = mix(base.rgb, aerialColor, aerial);
      c = mix(c, color, clamp(f, 0.0, most));
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
  setView(focusY: number, inside: boolean, iso: { distance: number; radius: number } | null): void;
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
  private tilt: TiltShiftPass;
  private grade: ShaderPass;
  private envTexture: THREE.Texture | null = null;
  private labels: LabelPass;
  private output = new OutputPass();
  /**
   * The look (#503): null for the game's own, or a retro or drawn style, whose
   * repaint and upscale (made on first use) follow the small picture, with the
   * labels drawn after at full size. `forced` is the address's ?look=, which wins
   * over the settings.
   */
  private style: RetroStyle | null = null;
  private retro: { repaint: ShaderPass; upscale: ShaderPass; labels: LabelPass; size: THREE.Vector2; pixel: number; unsubscribe: () => void } | null = null;
  /** Once a frame is drawn, materials have compiled, so the wobble and cel bands can't be patched in any more. */
  private rendered = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private forced: RetroStyle | null = null,
  ) {
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.scenePass = new ScenePass(scene, camera);
    this.ao = new SceneAOPass(scene, camera, 1, 1);
    this.ao.setGBuffer(this.scenePass.target.depthTexture!);
    this.ao.updateGtaoMaterial(LOOK.ao);
    this.haze = new ShaderPass(HazeShader);
    this.haze.uniforms.tDepth!.value = this.scenePass.target.depthTexture;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
    this.tilt = new TiltShiftPass(this.scenePass.target.depthTexture!, camera);
    this.grade = new ShaderPass(GradeShader);
    this.labels = new LabelPass(scene, camera, this.scenePass.target.depthTexture!);
    this.setStyle(forced, true);
  }

  /** The retro or drawn style showing, or null for the game's own look. */
  get retroStyle(): RetroStyle | null {
    return this.style;
  }

  /** Switch the look: rebuild the chain of passes, with or without the repaint and the upscale. */
  private setStyle(style: RetroStyle | null, first = false): void {
    if (style === this.style && !first) return;
    this.style = style;
    let chain: Pass[];
    if (style) {
      initRetroTuning(style);
      // These change the scene's own shaders, so only before anything has compiled (on reload).
      if (!this.rendered) {
        snapVertices(retroTuning.wobble);
        bandLighting(retroTuning.celBands);
      }
      const r = this.retroParts();
      applyRetroTuning(r.repaint.uniforms, r.upscale.uniforms, retroTuning);
      // The same effects, on the small picture; then the repaint and the upscale. No tilt-shift: blur fights the pixels.
      chain = [this.scenePass, this.ao, this.haze, this.bloom, this.output, this.grade, r.repaint, r.upscale];
    } else {
      chain = [this.scenePass, this.ao, this.haze, this.bloom, this.tilt, this.labels, this.output, this.grade];
    }
    // Retro: no antialiasing, so edges stay as hard steps.
    const samples = style ? 0 : 4;
    if (this.scenePass.target.samples !== samples) {
      this.scenePass.target.samples = samples;
      this.scenePass.target.dispose();
    }
    this.composer.passes.length = 0;
    for (const p of chain) this.composer.addPass(p);
    if (!first) this.resize();
  }

  private retroParts(): NonNullable<Look["retro"]> {
    if (this.retro) return this.retro;
    const repaint = new ShaderPass(retroShader());
    repaint.uniforms.tDepth!.value = this.scenePass.target.depthTexture;
    const upscale = new ShaderPass(upscaleShader());
    // Live tuning from the panel: new uniforms, and a new size when the pixels change.
    const unsubscribe = onRetroTuning(() => {
      if (!this.style || !this.retro) return;
      applyRetroTuning(repaint.uniforms, upscale.uniforms, retroTuning);
      if (retroTuning.pixel !== this.retro.pixel) this.resize();
    });
    this.retro = { repaint, upscale, labels: new LabelPass(this.scene, this.camera, this.scenePass.target.depthTexture!), size: new THREE.Vector2(), pixel: retroTuning.pixel, unsubscribe };
    return this.retro;
  }

  /** Apply graphics settings: which effects run and how strongly, the resolution, and reflections. */
  setGraphics(g: Graphics): void {
    this.graphics = g;
    this.setStyle(this.forced ?? (g.style === "standard" ? null : g.style));
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

  /** How hard a dust storm is blowing, 0 to 1: the haze thickens and browns, near and far. */
  setStorm(level: number): void {
    this.storm = level;
    const u = this.haze.uniforms;
    (u.color!.value as THREE.Color).set(LOOK.haze.color).lerp(new THREE.Color(LOOK.storm.color), level);
    u.density!.value = LOOK.haze.density + (LOOK.storm.density - LOOK.haze.density) * level;
    u.clear!.value = LOOK.haze.clear + (LOOK.storm.clear - LOOK.haze.clear) * level;
    u.most!.value = LOOK.haze.max + (LOOK.storm.max - LOOK.haze.max) * level;
    this.setAerial();
  }

  private daylight = 1;

  /** The air's colour and thickness over the land: the sky's at the horizon by the hour, browner and thicker in a storm. */
  private setAerial(): void {
    const u = this.haze.uniforms;
    const a = LOOK.aerial;
    (u.aerialColor!.value as THREE.Color).set(a.night).lerp(AERIAL_DAY, this.daylight).lerp(STORM_DUST, this.storm * 0.7);
    u.aerialDensity!.value = a.density * (1 + (a.storm - 1) * this.storm);
    u.aerialMost!.value = a.max + (0.92 - a.max) * this.storm;
  }

  /** Daylight, 0 (night) to 1 (noon), for the mood near the surface. */
  setDaylight(light: number): void {
    this.haze.uniforms.daylight!.value = light;
    this.daylight = light;
    this.setAerial();
  }

  /**
   * Where the view is: the height of the floor in view (what's below it hazes
   * over), whether it's from inside the hole (far things haze too), and, in
   * Free view (the only view tilt-shift suits), how far the camera is from what
   * it orbits and the hole's outer radius, for the miniature's focus.
   */
  setView(focusY: number, inside: boolean, iso: { distance: number; radius: number } | null): void {
    this.haze.uniforms.focusY!.value = focusY;
    this.haze.uniforms.byDistance!.value = Math.max(inside ? 1 : 0, this.storm);
    if (iso) this.tilt.setFocus(iso.distance, iso.radius);
    if (!!iso === this.iso) return;
    this.iso = !!iso;
    this.applyTiltShift();
  }

  private applyTiltShift(): void {
    const t = this.graphics?.tiltShift ?? 0;
    this.tilt.enabled = this.iso && t > 0;
    this.tilt.setAmount(t);
  }

  /** Match the canvas: call after the renderer's size or pixel ratio changes. */
  resize(): void {
    if (this.style && this.retro) {
      // The small picture, scaled up by a whole number to cover the screen; the labels draw at the screen's own size.
      const px = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const css = this.renderer.getSize(new THREE.Vector2());
      this.retro.pixel = retroTuning.pixel;
      const g = retroGrid(px.x, px.y, retroTuning.pixel * (px.y / Math.max(1, css.y)));
      this.composer.setPixelRatio(1);
      this.composer.setSize(g.w, g.h);
      this.scenePass.setSize(g.w, g.h);
      this.retro.repaint.uniforms.resolution!.value.set(g.w, g.h);
      const up = this.retro.upscale.uniforms;
      up.lowSize!.value.set(g.w, g.h);
      up.screen!.value.set(px.x, px.y);
      up.scale!.value = g.scale;
      this.retro.size.set(g.w * g.scale, g.h * g.scale);
      return;
    }
    const css = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(css.x, css.y);
    const px = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.scenePass.setSize(px.x, px.y);
  }

  render(): void {
    this.rendered = true;
    if (this.style && this.retro) {
      const u = this.haze.uniforms;
      u.projectionInverse!.value.copy(this.camera.projectionMatrixInverse);
      u.cameraWorld!.value.copy(this.camera.matrixWorld);
      const r = this.retro.repaint.uniforms;
      r.cameraNear!.value = this.camera.near;
      r.cameraFar!.value = this.camera.far;
      r.projectionInverse!.value.copy(this.camera.projectionMatrixInverse);
      r.cameraWorld!.value.copy(this.camera.matrixWorld);
      // Metres one small-picture pixel spans per metre away.
      r.pixelAngle!.value = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / Math.max(1, r.resolution!.value.y);
      this.composer.render();
      this.retro.labels.drawTo(this.renderer, null, this.retro.size.x, this.retro.size.y);
      return;
    }
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
    this.retro?.unsubscribe();
    this.composer.dispose();
    this.scenePass.dispose();
    this.ao.dispose();
    this.bloom.dispose();
    this.tilt.dispose();
    this.envTexture?.dispose();
  }
}
