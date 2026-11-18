import * as THREE from "three";

// Room labels, their trouble badges and construction progress sit on a layer of their own, so the
// look can draw them after the tilt-shift blur and keep them sharp (look.ts).
// Drawn then, they can't use the depth buffer (the post passes have none), so
// they look at the scene's depth texture in their shader instead.
//
// A label is shown or hidden whole, never cut (#516): its vertex shader samples the
// scene's depth on a grid across the label, and the share of those points with nothing
// standing in front decides how much of it shows. A chair or a door frame over part of
// a label leaves it up, whole; a wall or a floor over all of it hides it, fading as it
// slides behind. The same shader fades labels that are both far off and near the edge
// of the view, where they'd only be clutter.

export const LABEL_LAYER = 1;

/**
 * How labels show. `slackM`: how far behind something a point may be and still count as seen
 * (metres along the view; labels sit under their ceiling, so this stays under the gap to the
 * floor above). `fullAt`: the share of points seen at which a label shows fully.
 * `edge`: from this far out (0 the middle of the view, 1 its edge) labels fade, but only those
 * between `nearM` (not at all) and `farM` (fully) away.
 */
export const LABEL_SHOW = { slackM: 0.3, fullAt: 0.34, edge: { from: 0.55, nearM: 70, farM: 160 } };

/** Shared by every label material: the scene's depth, and whether to test against it (only in the look's label pass). */
export const labelDepth = {
  tSceneDepth: { value: null as THREE.Texture | null },
  sceneDepthOn: { value: 0 },
  sceneSize: { value: new THREE.Vector2(1, 1) },
  cameraNear: { value: 0.1 },
  cameraFar: { value: 1000 },
  labelShow: { value: new THREE.Vector4(LABEL_SHOW.slackM, LABEL_SHOW.fullAt, 0, 0) },
  labelEdge: { value: new THREE.Vector3(LABEL_SHOW.edge.from, LABEL_SHOW.edge.nearM, LABEL_SHOW.edge.farM) },
};

const VERTEX_HEAD = `uniform sampler2D tSceneDepth;
uniform float sceneDepthOn;
uniform float cameraNear;
uniform float cameraFar;
uniform vec4 labelShow;
uniform vec3 labelEdge;
varying float vLabelShow;
void main() {`;

// After the sprite's own position is worked out: \`scale\` is its size in metres, the label's centre is modelViewMatrix[3].
const VERTEX_TAIL = `#include <fog_vertex>
  vec4 labelMid = modelViewMatrix[ 3 ];
  float shown = 1.0;
  vec4 midClip = projectionMatrix * labelMid;
  if ( midClip.w > 0.0 ) {
    vec2 ndc = midClip.xy / midClip.w;
    float rim = max( abs( ndc.x ), abs( ndc.y ) );
    shown *= 1.0 - smoothstep( labelEdge.x, 1.0, rim ) * smoothstep( labelEdge.y, labelEdge.z, - labelMid.z );
  }
  if ( sceneDepthOn > 0.5 ) {
    float seen = 0.0;
    float tried = 0.0;
    for ( int i = 0; i < 9; i ++ ) {
      vec2 at = vec2( float( i - ( i / 3 ) * 3 ) - 1.0, float( i / 3 ) - 1.0 ) * 0.4 * scale;
      vec4 p = projectionMatrix * vec4( labelMid.xy + at, labelMid.z, 1.0 );
      if ( p.w <= 0.0 ) continue;
      vec2 uv = p.xy / p.w * 0.5 + 0.5;
      if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) continue;
      tried += 1.0;
      float d = texture2D( tSceneDepth, uv ).x;
      // The scene's depth there as a view-space z (negative, like labelMid.z).
      float sceneZ = cameraNear * cameraFar / ( ( cameraFar - cameraNear ) * d - cameraFar );
      if ( sceneZ <= labelMid.z + labelShow.x ) seen += 1.0;
    }
    shown *= tried > 0.0 ? smoothstep( 0.0, labelShow.y, seen / tried ) : 0.0;
  }
  vLabelShow = shown;
  // Hidden: off the screen, so it costs no fragments.
  if ( shown < 0.002 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );`;

/** Teach a label's material to show whole or not at all against the scene's depth, and to fade far off at the edge of the view. */
export function testsSceneDepth(m: THREE.SpriteMaterial): THREE.SpriteMaterial {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, labelDepth);
    shader.vertexShader = shader.vertexShader.replace("void main() {", VERTEX_HEAD).replace("#include <fog_vertex>", VERTEX_TAIL);
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vLabelShow;\nvoid main() {")
      .replace("#include <alphatest_fragment>", "diffuseColor.a *= vLabelShow;\n  #include <alphatest_fragment>");
  };
  m.customProgramCacheKey = () => "label-show-whole";
  return m;
}
