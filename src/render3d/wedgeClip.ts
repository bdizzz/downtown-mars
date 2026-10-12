import * as THREE from "three";

// The cutaway takes a wedge out of the hole (T-143): what's past both of its two cut planes goes. Three
// clips what's past *any* of the renderer's planes (a union), which can only take out half the world
// or more; per-material planes can intersect, but every material would need them. Nothing in the game
// clips per material, so the renderer's own planes are made to intersect instead: a fragment goes only
// when it's past every plane. With a flat cut both planes are the same, and it's as before. WebGL only:
// the WebGPU experiment clips through its own nodes, and the stage gives it the flat cut.

/** The plain (no alpha-to-coverage) branch's loop over the union planes, which discards past any one of them. */
const UNION =
  /(#else\s*)(#pragma unroll_loop_start\s*for \( int i = 0; i < UNION_CLIPPING_PLANES; i \+\+ \) \{\s*plane = clippingPlanes\[ i \];\s*)if \( dot\( vClipPosition, plane\.xyz \) > plane\.w \) discard;(\s*\}\s*#pragma unroll_loop_end)/;
/** The same loop, discarding only past all of them. */
const INTERSECTION = "$1bool pastAll = UNION_CLIPPING_PLANES > 0;\n$2pastAll = ( dot( vClipPosition, plane.xyz ) > plane.w ) && pastAll;$3\nif ( pastAll ) discard;";

let done = false;

/** Make the renderer's clipping planes intersect (see above). Safe to call more than once; false if three's chunk has changed shape. */
export function intersectGlobalClipping(): boolean {
  if (done) return true;
  const chunk = THREE.ShaderChunk.clipping_planes_fragment;
  if (!UNION.test(chunk)) {
    console.warn("3D: three's clipping chunk has changed; the cutaway's wedge falls back to a flat cut");
    return false;
  }
  THREE.ShaderChunk.clipping_planes_fragment = chunk.replace(UNION, INTERSECTION);
  done = true;
  return true;
}
