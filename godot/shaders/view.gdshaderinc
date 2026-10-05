// What every surface of the hole shares with the view (set by Live.cs as global shader parameters):
// the cutaway's cut, a plane through the shaft's axis (xz its normal toward the camera, w 1 when on;
// what's on the camera's side isn't drawn); and walls down (1 when on).
global uniform vec4 cut_plane;
global uniform float walls_down;

bool cut_away(vec3 world) {
	return cut_plane.w > 0.5 && dot(world.xz, cut_plane.xz) > 0.0;
}

// Iso's cut-out with a floor picked, as the web's (surfaces.ts withSlice): the land sliced through the
// hole's axis (slice: xy toward the camera, z the radius of the opening over the rings, w 1 when on),
// thinning out with distance past the rings in a fine stipple (slice_fade: x to y metres past them; z how
// far it's opened, easing 0 to 1). Where land meets the cut, both crumble over slice_look.x metres; the
// cut rock darkens toward the backdrop's earth by up to slice_look.y, fully by slice_look.z metres down
// or the far end of the fade. Only materials given a slice_role take it: 1 the land (its near half and
// over the rings dissolve away, the rest thins out and crumbles by the cut), 2 the cut face (dissolves
// in, thins out, crumbles along its top, darkens), 3 the rock wall (darkens; its near half isn't built).
global uniform vec4 slice;
global uniform vec4 slice_fade;
global uniform vec4 slice_look;
uniform int slice_role = 0;
// The backdrop's earth (the web's C.earth, #241410), linear.
const vec3 SLICE_EARTH = vec3(0.0176, 0.0070, 0.0052);

float slice_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float slice_noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(slice_hash(i), slice_hash(i + vec2(1.0, 0.0)), f.x), mix(slice_hash(i + vec2(0.0, 1.0)), slice_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// How much crumbles away at d metres from the cut (1 at it, 0 past the edge), ragged by the noise at q.
float slice_crumble(float d, vec2 q) {
	float rough = slice_noise(q * 0.35) * 0.65 + slice_noise(q * 1.3) * 0.35;
	return 1.0 - smoothstep(0.0, slice_look.x, d - (rough - 0.5) * slice_look.x);
}
float slice_fade_at(vec3 world) {
	return smoothstep(slice.z + slice_fade.x, slice.z + slice_fade.y, length(world.xz));
}

bool sliced_away(vec3 world, vec2 frag) {
	if (slice_role == 0 || slice_role == 3 || slice.w < 0.5) return false;
	float n = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))));
	float d = length(world.xz);
	float fade = slice_fade_at(world);
	float a = slice_fade.z;
	if (slice_role == 1)
		return (dot(world.xz, slice.xy) > 0.0 || d < slice.z) ? n < a : n < max(fade, slice_crumble(-dot(world.xz, slice.xy), world.xz)) * a;
	return n > a || n < max(fade, slice_crumble(-world.y, vec2(world.x + world.z, world.y)));
}

// How far the cut rock (the face and the wall) darkens toward the backdrop: with depth, and along the fade.
float slice_darken(vec3 world) {
	if (slice_role < 2 || slice.w < 0.5) return 0.0;
	return slice_look.y * max(smoothstep(0.0, slice_look.z, -world.y), slice_fade_at(world));
}

// Walls down, as the web's (rooms3d.ts WALLS_GLSL): a wall vertex tagged with its wall's inward normal
// (xy) and the wall's bottom and top (zw), and a line's second wall (wall2), drops to a stub when the
// camera is on its far side. A longer normal means there's something to see across it: always lowered.
vec3 lower_wall(vec3 v, vec4 wall, vec2 wall2, vec3 world, vec3 camera) {
	if (walls_down < 0.5 || dot(wall.xy, wall.xy) <= 0.0) return v;
	vec2 to_cam = camera.xz - world.xz;
	float n2 = dot(wall2, wall2);
	bool second = n2 == 0.0 || n2 > 2.0 || dot(to_cam, wall2) < 0.0;
	bool first = dot(wall.xy, wall.xy) > 2.0 || dot(to_cam, wall.xy) < 0.0;
	if (first && second) v.y = min(v.y, mix(wall.z, wall.w, 0.15));
	return v;
}
