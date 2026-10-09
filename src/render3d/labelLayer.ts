import * as THREE from "three";

// Room labels (and their trouble badges) sit on a layer of their own, so the
// look can draw them after the tilt-shift blur and keep them sharp (look.ts).
// Drawn then, they can't use the depth buffer (the post passes have none), so
// they test against the scene's depth texture in their shader instead.

export const LABEL_LAYER = 1;

/** Shared by every label material: the scene's depth, and whether to test against it (only in the look's label pass). */
export const labelDepth = {
  tSceneDepth: { value: null as THREE.Texture | null },
  sceneDepthOn: { value: 0 },
  sceneSize: { value: new THREE.Vector2(1, 1) },
};

/** Teach a label's material to hide behind the scene's depth when drawn after the post passes. */
export function testsSceneDepth(m: THREE.SpriteMaterial): THREE.SpriteMaterial {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, labelDepth);
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform sampler2D tSceneDepth;\nuniform float sceneDepthOn;\nuniform vec2 sceneSize;\nvoid main() {")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (sceneDepthOn > 0.5 && gl_FragCoord.z > texture2D(tSceneDepth, gl_FragCoord.xy / sceneSize).x + 1e-6) discard;");
  };
  m.customProgramCacheKey = () => "label-scene-depth";
  return m;
}
