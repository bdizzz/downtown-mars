// What every surface of the hole shares with the view (set by Live.cs as global shader parameters):
// the cutaway's cut, a plane through the shaft's axis (xz its normal toward the camera, w 1 when on;
// what's on the camera's side isn't drawn); and walls down (1 when on).
global uniform vec4 cut_plane;
global uniform float walls_down;

bool cut_away(vec3 world) {
	return cut_plane.w > 0.5 && dot(world.xz, cut_plane.xz) > 0.0;
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
