// The map's globe (MapView.cs), as the web's (ui/Globe.tsx, #499): the planet's colour (the base map, or a sharper
// tile laid over it) on ground raised by MOLA's heights (public/map/height.png, exaggerated so they show), each
// pixel's normal tilted by the height map's slopes so the relief catches the light, with the game's deposits
// (a transparent overlay of the whole planet) painted over it all.
// UV is the colour's own (the whole planet for the base sphere, the tile's square for a tile); UV2 is the
// whole planet's, longitude 0 at the left, north at the top, for the heights and the overlay.
shader_type spatial;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D overlay_tex : source_color, hint_default_transparent, filter_linear_mipmap, repeat_enable;
uniform sampler2D height_tex : filter_linear, repeat_enable;
/// The globe's radius; the heights' range in radii (exaggerated) and where 0 m falls in the map; how far above
/// the ground this layer sits (in radii: tiles a hair over the base sphere); 0 till the heights are in.
uniform float radius = 10.0;
uniform float relief_scale = 0.088;
uniform float relief_zero = 0.283;
uniform float lift = 0.0;
uniform float relief_on = 0.0;
/// One texel of the height map.
uniform vec2 height_px = vec2(0.000694444, 0.001388889);

varying vec3 v_dir;

float relief_at(vec2 uv) { return (textureLod(height_tex, uv, 0.0).r - relief_zero) * relief_scale * relief_on; }

void vertex() {
	vec3 d = normalize(VERTEX);
	v_dir = d;
	VERTEX = d * radius * (1.0 + lift + relief_at(UV2));
}

void fragment() {
	vec2 uv = UV2;
	// The ground's slopes along east and north, in radii per radian, from the heights either side.
	vec2 px = height_px;
	float c = max(0.08, cos((0.5 - uv.y) * PI));
	float gx = (relief_at(uv + vec2(px.x, 0.0)) - relief_at(uv - vec2(px.x, 0.0))) / (2.0 * px.x * TAU * c);
	float gy = (relief_at(uv - vec2(0.0, px.y)) - relief_at(uv + vec2(0.0, px.y))) / (2.0 * px.y * PI);
	vec3 up = normalize(v_dir);
	vec3 east = normalize(vec3(up.z, 0.0, -up.x) + vec3(1e-5, 0.0, 0.0));
	vec3 north = cross(up, east);
	vec3 n = normalize(up - gx * east - gy * north);
	NORMAL = normalize((VIEW_MATRIX * MODEL_MATRIX * vec4(n, 0.0)).xyz);
	vec3 col = texture(albedo_tex, UV).rgb;
	vec4 over = texture(overlay_tex, uv);
	ALBEDO = mix(col, over.rgb, over.a);
	ROUGHNESS = 1.0;
	SPECULAR = 0.3;
}
