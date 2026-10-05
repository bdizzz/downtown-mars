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
// far it's opened, easing 0 to 1). Only materials given a slice_role take it: 1 the land (its near half
// and over the rings dissolve away, the rest thins out), 2 the cut face (dissolves in, thinning out).
global uniform vec4 slice;
global uniform vec4 slice_fade;
uniform int slice_role = 0;

bool sliced_away(vec3 world, vec2 frag) {
	if (slice_role == 0 || slice.w < 0.5) return false;
	float n = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))));
	float d = length(world.xz);
	float fade = smoothstep(slice.z + slice_fade.x, slice.z + slice_fade.y, d);
	float a = slice_fade.z;
	if (slice_role == 1) return (dot(world.xz, slice.xy) > 0.0 || d < slice.z) ? n < a : n < fade * a;
	return n > a || n < fade;
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
