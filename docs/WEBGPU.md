# WebGPU experiment

Bryon, Oct 1, 2026: before considering a native macOS port for better graphics, see how far three.js's WebGPU renderer gets us in the browser.

## How to try it

Open the game with `?renderer=webgpu` (http://localhost:5173/?renderer=webgpu). The console says which backend it got ("WebGPU", or "WebGL 2 fallback" on browsers without WebGPU). Without the flag nothing changes.

## Findings (first spike)

- **It runs.** three 0.186 shares one core between its WebGL and WebGPU builds, so `WebGPURenderer` (from `three/webgpu`) draws our scene as it is: rooms, furniture, rig, terrain, people, the lander. In this browser it got a real WebGPU backend.
- **Speed:** about 2.7 ms of CPU a frame, 1,240 draw calls and 105k triangles for a small colony, with no post effects. Not a like-for-like comparison yet (the WebGL path runs the whole post pipeline), but no sign of trouble.
- **What's missing** is everything we wrote as raw GLSL, which WebGPU can't take:
  - **12 shader tweaks** injected with `onBeforeCompile` (`surfaces.ts`, `details3d.ts`, `furniture3d.ts`, `rooms3d.ts`): the procedural rock, regolith, floors, brick, metal and marscrete; grime, fresnel, condensation; glow, sway and shimmer; furniture part patterns; walls down and hangings down. Without them surfaces are flat colour, and Walls down doesn't lower walls.
  - **4 `ShaderMaterial`s**: the sky (black without it), resource flows, light shafts down the shaft, the overlay field.
  - **The whole look** (`look.ts`): ambient occlusion, haze, bloom, tilt-shift and the colour grade are WebGL post passes. `PlainLook` stands in, drawing the scene straight to the screen.
  - **Cutaway clipping** (`renderer.clippingPlanes`), which WebGPU does with clipping groups instead.
- **WebGPU alone doesn't make it prettier.** It's a faster, more modern pipe. The visual gains come from what it makes practical: screen-space global illumination (light bouncing off walls), screen-space reflections (glass, polished floors), better AO, temporal anti-aliasing, many more lamps with shadows, and GPU particles (dust, lanterns, sparks).

## The port, if we go on

All in TSL, three's node shading language (JavaScript that compiles to WGSL for WebGPU and GLSL for WebGL 2, so one version serves both):

1. **Surfaces and tweaks** as node functions on `MeshStandardNodeMaterial` (`colorNode`, `positionNode`, `emissiveNode`), one `with…` helper at a time, keeping the same names so callers don't change. The biggest piece.
2. **Sky, flows, light shafts, overlay** as node materials.
3. **The look** as a TSL post chain: `ao()`, `bloom()`, depth of field for tilt-shift, haze and grade as small node functions.
4. **Cutaway** with a clipping group.
5. **Then the new things:** SSGI, SSR on glass and floors, TRAA, shadowed lamps, GPU particles.

Once 1–4 are done, WebGPU could become the default with WebGL 2 as its automatic fallback, and the old GLSL path retired.

## The effects preview (Oct 1)

`render3d/lookGpu.ts` (`GpuLook`), used with `?renderer=webgpu`: one scene pass writing five targets (colour, base colour, normals, metal/roughness, motion), then SSGI, SSR, bloom and TRAA. `?fx=gi,ssr,bloom,traa` picks effects (`?fx=none` for the bare scene); in dev, `__gpuFx("gi")` switches live and `__gpuGi(0.35)` / `__gpuSsr(0.6)` set strengths.

What it took:
- The five targets need 40 bytes a pixel against WebGPU's default limit of 32 (even 8-bit targets count 8 bytes each): the renderer asks for 64 (`requiredLimits`; Apple GPUs allow 128).
- No MSAA in this mode (`antialias: false`, a single-sampled pass): the effects read depth, which can't be copied from a multisampled buffer; TRAA smooths edges instead.
- SSGI's bounce added on top of our fill lights (hemisphere, ambient) roughly triples the brightness and washes everything out: it runs at a 0.35 share. A real port would trim the fill lights instead.
- Glass and other see-through materials write zero alpha into the effects' buffers (`material.mrtNode`), or SSGI lights the tube glass as if it were solid and turns it milky.

What it looks like (same save, paused at 00:30, same camera; screenshots shared in conversation):
- **From Iso distance, today's WebGL look is warmer and richer.** Its procedural rock, haze and colour grade carry the mood, and none of them are ported yet. The new effects are subtle at that distance.
- **Close up, WebGPU adds deeper contact shadows** under railings, at wall bases and round furniture, and a moodier, more grounded contrast. Bounced light tints surfaces near lit ones, softly.
- **Reflections barely show:** almost all our surfaces are rough (0.75–0.9). SSR pays off only once floors, tubes and metal are given glossier materials.
- **Cost:** fine on this Mac; not measured on weaker GPUs.

Verdict for now: WebGPU is a good foundation (the effects work, glass is handled, the pipe is fast), but the visible gain over today's tuned WebGL look is modest until the procedural surfaces, sky, haze and grade come across (the 4–6 day port above) and the materials are retuned to give SSR and SSGI something to work with.

## Then (Oct 1): option 2, better looks within WebGL

Bryon chose to improve the WebGL look first. Built: sun shadows (a **Shadows** graphics setting; the sun shines harder with them, since rock keeps it out of the rooms, and is left as it was when a floor is picked), floor gloss by kind, shinier metal finishes, and a warm cave environment for reflections instead of the studio. Lamp shadows were tried and dropped: indoor light is mostly fill and the camera's lamp, so they barely showed, and walking would redraw two cube maps every time the nearest lamps changed.
