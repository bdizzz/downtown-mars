// What every surface of the hole shares with the view (set by Live.cs as global shader parameters):
// the cutaway's cut, a plane through the shaft's axis (xz its normal toward the camera, w 1 when on;
// what's on the camera's side isn't drawn); and walls down (1 when on).
global uniform vec4 cut_plane;
global uniform float walls_down;

bool cut_away(vec3 world) {
	return cut_plane.w > 0.5 && dot(world.xz, cut_plane.xz) > 0.0;
}

// Iso's cut-out with a floor picked, as the web's (surfaces.ts withSlice): the land sliced square to the
// camera (slice: xy toward the camera, z the radius of the opening over the rings, w 1 when on),
// thinning out with distance past the rings in a fine stipple (slice_fade: x to y metres past them; z how
// far it's opened, easing 0 to 1). The cut runs slice_look.w metres toward the camera from the axis, where
// the rings look widest. Where land meets the cut, both crumble over slice_look.x metres; the
// cut rock darkens toward the backdrop's earth by up to slice_look.y, fully by slice_look.z metres down
// or the far end of the fade. Only materials given a slice_role take it: 1 the land (its near half and
// over the rings dissolve away, the rest thins out and crumbles by the cut), 2 the cut face (dissolves
// in, thins out, crumbles along its top, darkens; nothing inside the wall), 3 the rock wall (its near side
// dissolves away; it darkens).
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
	if (slice_role == 0 || slice.w < 0.5) return false;
	float n = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))));
	float d = length(world.xz);
	float fade = slice_fade_at(world);
	float a = slice_fade.z;
	float side = dot(world.xz, slice.xy) - slice_look.w;
	if (slice_role == 1)
		return (side > 0.0 || d < slice.z) ? n < a : n < max(fade, slice_crumble(-side, world.xz)) * a;
	if (slice_role == 3) return side > 0.0 && n < a;
	return d < slice.z || n > a || n < max(fade, slice_crumble(-world.y, vec2(world.x + world.z, world.y)));
}

// How far the cut rock (the face and the wall) darkens toward the backdrop: with depth, and along the fade.
float slice_darken(vec3 world) {
	if (slice_role < 2 || slice.w < 0.5) return 0.0;
	return slice_look.y * max(smoothstep(0.0, slice_look.z, -world.y), slice_fade_at(world));
}

// Walls down, as the web's (rooms3d.ts inFront, inTheWay). How far in front of a wall face the camera
// stands, at the face's nearest and furthest (negative: seen from behind there). `face` is where it stands:
// a flat face's plane offset along n (x), or a curved face's radius and angles (x, y < z).
vec2 wall_in_front(vec2 n, vec3 face, vec2 cam) {
	if (face.z <= face.y) return vec2(dot(cam, n) / length(n) - face.x);
	float dist = length(cam);
	float th = atan(cam.y, cam.x);
	float span = face.z - face.y;
	float e0 = cos(face.y - th);
	float e1 = cos(face.z - th);
	float hi = mod(th - face.y, TAU) <= span ? 1.0 : max(e0, e1);
	float lo = mod(th + PI - face.y, TAU) <= span ? -1.0 : min(e0, e1);
	float m = 0.5 * (face.y + face.z);
	return dot(n, vec2(cos(m), sin(m))) > 0.0 ? vec2(dist * lo - face.x, dist * hi - face.x) : vec2(face.x - dist * hi, face.x - dist * lo);
}

// Is a wall face with inward normal n, from y0 to y1, in the camera's way (the camera in the model's frame)?
// The whole face answers as one: seen from behind anywhere, yes. A normal of length 2 + r means a room starts
// r metres past it: seen from its own side, it's in the way when the line over its top is still above the
// stub's height (15%) at r, at the face's furthest from the camera.
bool wall_in_the_way(vec2 n, vec3 face, vec3 cam, float y0, float y1) {
	vec2 q = wall_in_front(n, face, cam.xz);
	if (q.x < 0.0) return true;
	float len = length(n);
	if (len < 1.5) return false;
	float rise = cam.y - y1;
	return rise <= 0.0 || q.y * (y1 - y0) * 0.85 > (len - 2.0) * rise;
}

// A wall vertex tagged with its face's inward normal (xy) and the wall's bottom and top (zw), and a line's
// second wall (wall2, as high as the first), with where their faces stand (face, face2), drops to a stub when
// the wall is in the way (both, for a line). `camera` is in the model's frame.
vec3 lower_wall(vec3 v, vec4 wall, vec2 wall2, vec3 face, vec3 face2, vec3 camera) {
	if (walls_down < 0.5 || dot(wall.xy, wall.xy) <= 0.0) return v;
	bool second = dot(wall2, wall2) == 0.0 || wall_in_the_way(wall2, face2, camera, wall.z, wall.w);
	if (second && wall_in_the_way(wall.xy, face, camera, wall.z, wall.w)) v.y = min(v.y, mix(wall.z, wall.w, 0.15));
	return v;
}
