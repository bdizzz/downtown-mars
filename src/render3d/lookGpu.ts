import type * as THREE from "three";
import { RenderPipeline, UnsignedByteType, type Node, type WebGPURenderer } from "three/webgpu";
import { add, colorToDirection, diffuseColor, directionToColor, metalness, mrt, normalView, output, pass, roughness, sample, uniform, vec2, vec4, velocity } from "three/tsl";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { ssr } from "three/examples/jsm/tsl/display/SSRNode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import type { Graphics } from "../view/graphics";
import type { LookLike } from "./look";

// The WebGPU experiment's look (docs/WEBGPU.md): a preview of what WebGPU makes
// practical, on the scene as it renders today (flat surfaces: the procedural
// shaders aren't ported yet). One scene pass records colour, base colour,
// normals, metal/roughness and motion; then
//   SSGI   light bouncing between surfaces, plus contact shadows (its AO),
//   SSR    reflections, on glass and polished floors as well as metal,
//   bloom  glow round lamps and lit windows,
//   TRAA   temporal anti-aliasing, which also smooths SSGI's and SSR's noise.
// Pick effects with ?fx=gi,ssr,bloom,traa (all by default; ?fx=none for the bare scene).

/** Bounced light is added on top of the scene's own fill lights (hemisphere, ambient), so only a share of it. */
const GI = { slices: 2, steps: 8, amount: 0.35 };
const BLOOM = { strength: 0.35, radius: 0.4, threshold: 0.85 };

export class GpuLook implements LookLike {
  private pipeline: RenderPipeline;
  private giAmount = uniform(GI.amount);
  private ssrAmount = uniform(0.6);
  private frame = 0;
  private patched = new WeakSet<THREE.Material>();

  constructor(
    private renderer: WebGPURenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.pipeline = this.build((new URLSearchParams(location.search).get("fx") ?? "gi,ssr,bloom,traa").split(","));
    // For comparing in the dev console: __gpuFx("gi,ssr") (or "none").
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__gpuFx = (fx: string) => this.setEffects(fx.split(","));
      // Live strength dials: __gpuGi(0.35), __gpuSsr(0.6).
      w.__gpuGi = (v: number) => (this.giAmount.value = v);
      w.__gpuSsr = (v: number) => (this.ssrAmount.value = v);
    }
  }

  /** Rebuild the chain with these effects (gi, ssr, bloom, traa). */
  setEffects(list: string[]): void {
    this.pipeline.dispose();
    this.pipeline = this.build(list);
  }

  private build(list: string[]): RenderPipeline {
    const fx = new Set(list);
    const { scene, camera } = this;
    // Single-sampled: SSGI and SSR read its depth directly.
    const scenePass = pass(scene, camera, { samples: 0 });
    scenePass.setMRT(
      mrt({
        output,
        diffuseColor,
        normal: directionToColor(normalView),
        metalrough: vec2(metalness, roughness),
        velocity,
      }),
    );
    // Normals, base colour and metal/roughness keep 8 bits a channel, so the five targets fit the default limit (32 bytes a pixel).
    for (const name of ["diffuseColor", "normal", "metalrough"]) scenePass.getTexture(name).type = UnsignedByteType;
    const color = scenePass.getTextureNode("output");
    const diffuse = scenePass.getTextureNode("diffuseColor");
    const depth = scenePass.getTextureNode("depth");
    const normalTex = scenePass.getTextureNode("normal");
    const metalRough = scenePass.getTextureNode("metalrough");
    const motion = scenePass.getTextureNode("velocity");
    const normal = sample((uv) => colorToDirection(normalTex.sample(uv)));

    let out: Node<"vec4"> = vec4(color);
    if (fx.has("gi")) {
      const gi = ssgi(color, depth, normal, camera);
      gi.sliceCount.value = GI.slices;
      gi.stepCount.value = GI.steps;
      // What arrives directly, darkened in the creases; plus what bounces in, tinted by the surface it lands on.
      out = vec4(add(color.rgb.mul(gi.a), diffuse.rgb.mul(gi.rgb).mul(this.giAmount)), color.a);
    }
    if (fx.has("ssr")) {
      const refl = ssr(color, depth, normal, { metalnessNode: metalRough.r, roughnessNode: metalRough.g, reflectNonMetals: true, camera });
      // Reflections laid over what's there, as strong as each surface is shiny.
      out = vec4(out.rgb.add(refl.rgb.mul(refl.a).mul(this.ssrAmount)), out.a);
    }
    if (fx.has("bloom")) out = vec4(out.rgb.add(bloom(out, BLOOM.strength, BLOOM.radius, BLOOM.threshold).rgb), out.a);
    if (fx.has("traa")) out = traa(out, depth, motion, camera);
    console.info(`3D look (WebGPU): ${[...fx].join(", ") || "none"}`);
    return new RenderPipeline(this.renderer, out);
  }

  setGraphics(g: Graphics): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, g.pixelRatio));
  }
  setStorm(): void {}
  setDaylight(): void {}
  setView(): void {}
  resize(): void {}
  render(): void {
    // Now and then, catch new see-through materials (rooms rebuild as you play).
    if (this.frame++ % 30 === 0) this.seeThrough();
    this.pipeline.render();
  }

  /**
   * Glass and other see-through materials leave the effects' buffers as they are (zero alpha, so they
   * blend away): the light bounces and reflects off what's behind them, not off the glass as if it were solid.
   */
  private seeThrough(): void {
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.Material & { mrtNode?: unknown }) | undefined;
      if (!m || Array.isArray(m) || !m.transparent || this.patched.has(m)) return;
      this.patched.add(m);
      m.mrtNode = mrt({ diffuseColor: vec4(0), normal: vec4(0), metalrough: vec4(0) });
      m.needsUpdate = true;
    });
  }
  dispose(): void {
    this.pipeline.dispose();
  }
}
