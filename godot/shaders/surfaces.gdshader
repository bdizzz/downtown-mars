// Procedural surfaces for the hole, as the web game's (src/render3d/surfaces.ts): patterns worked
// out from each point's position in the world, so nothing needs unwrapping and they read the same
// on walls and floors. Ported from its GLSL, plus what the web doesn't do: each pattern's relief
// bends the light (grout, plank gaps, panel seams and rock strata catch the lamps), and the
// gaps are rougher than the faces.
shader_type spatial;
render_mode cull_disabled;

// 0 a room (walls in its colour, floor by kind), 1 rock, 2 regolith, 3 marscrete, 4 brick, 5 metal.
uniform int look = 0;
// Floors (look 0): 0 planks, 1 tiles, 2 diamond plate, 3 paving, 4 concrete.
uniform int floor_kind = 4;
uniform vec3 albedo : source_color = vec3(0.6);
uniform vec3 floor_color : source_color = vec3(0.6);
uniform float floor_tint = 0.2;
uniform float roughness = 0.8;
uniform float metallic = 0.0;
uniform float floor_roughness = 0.8;
uniform float floor_metallic = 0.0;
// Wear, 0 (spotless) to 3.
uniform float grime = 0.0;
// How much the pattern's relief bends the light.
uniform float bump = 1.0;

varying vec3 wpos;
varying vec3 wnorm;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

float srf_hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float srf_noise(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(mix(srf_hash(i + vec3(0, 0, 0)), srf_hash(i + vec3(1, 0, 0)), f.x), mix(srf_hash(i + vec3(0, 1, 0)), srf_hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(srf_hash(i + vec3(0, 0, 1)), srf_hash(i + vec3(1, 0, 1)), f.x), mix(srf_hash(i + vec3(0, 1, 1)), srf_hash(i + vec3(1, 1, 1)), f.x), f.y),
		f.z);
}

float srf_fbm(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 3; i++) {
		v += a * srf_noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

// Where on a surface a point is: on a wall, along it (round a curved wall by arc length, out along a radial one) and up; on a floor, x and z.
vec2 surface_uv(vec3 p, vec3 n) {
	if (abs(n.y) > 0.7) return p.xz;
	vec2 radial = normalize(p.xz + 1e-5);
	float along = abs(dot(normalize(n.xz + 1e-5), radial)) > 0.7 ? atan(p.z, p.x) * length(p.xz) : length(p.xz);
	return vec2(along, p.y);
}

// Each tone returns a shade (x) and a height for the relief (y): 1 on a face, lower in a gap.

vec2 rock_tone(vec3 p) {
	float s = p.y / 1.4 + (srf_fbm(p * 0.05) - 0.5) * 0.9;
	float band = floor(s);
	float edge = smoothstep(0.0, 0.12, fract(s)) * (1.0 - smoothstep(0.88, 1.0, fract(s)));
	float shade = mix(0.84, 1.1, srf_hash(vec3(band, 3.1, 7.7)));
	shade *= mix(0.9, 1.0, edge);
	float mottle = srf_fbm(p * 0.35);
	float grain = srf_noise(p * 6.0);
	shade *= mix(0.9, 1.08, mottle);
	shade *= mix(0.93, 1.05, grain);
	shade *= 1.0 - 0.18 * smoothstep(0.78, 0.86, srf_noise(p * 2.7 + 11.0));
	// Relief: the seams between strata sink, the stone between is lumpy.
	return vec2(shade, edge * 0.6 + mottle * 0.3 + grain * 0.1);
}

vec2 regolith_tone(vec3 p) {
	float broad = srf_fbm(p * 0.12);
	float fine = srf_noise(p * 4.0);
	float shade = mix(0.9, 1.07, broad) * mix(0.94, 1.04, fine);
	float pebble = smoothstep(0.8, 0.88, srf_noise(p * 1.9 + 5.0));
	shade *= 1.0 - 0.12 * pebble;
	return vec2(shade, broad * 0.5 + fine * 0.3 + pebble * 0.2);
}

vec2 brick_tone(vec3 p, vec3 n) {
	vec2 uv = surface_uv(p, n);
	if (abs(n.y) > 0.7) {
		vec2 t = uv / 0.6;
		vec2 f = fract(t);
		float grout = step(0.04, f.x) * step(0.04, f.y);
		return vec2(mix(0.62, mix(0.9, 1.06, srf_hash(vec3(floor(t), 2.0))), grout), grout);
	}
	vec2 b = uv / vec2(0.5, 0.2);
	b.x += 0.5 * mod(floor(b.y), 2.0);
	vec2 f = fract(b);
	float mortar = step(0.05, f.x) * step(0.08, f.y);
	float shade = mix(0.82, 1.1, srf_hash(vec3(floor(b), 5.0))) * mix(0.94, 1.04, srf_noise(p * 5.0));
	return vec2(mix(1.3, shade, mortar), mortar);
}

vec2 metal_tone(vec3 p, vec3 n) {
	vec2 uv = surface_uv(p, n);
	if (abs(n.y) > 0.7) {
		vec2 d = uv * 6.0;
		float plate = abs(fract(d.x + d.y) - 0.5) + abs(fract(d.x - d.y) - 0.5);
		float seams = step(0.02, fract(uv.x / 2.0)) * step(0.02, fract(uv.y / 2.0));
		float raised = smoothstep(0.35, 0.6, plate);
		return vec2(mix(0.7, mix(0.95, 1.08, raised), seams), seams * (0.6 + 0.4 * raised));
	}
	vec2 size = vec2(1.2, 1.0);
	vec2 f = fract(uv / size);
	vec2 edge = min(f, 1.0 - f) * size;
	float seam = step(0.012, edge.x) * step(0.012, edge.y);
	float along_y = (fract(uv.y / 0.25) - 0.5) * 0.25;
	float along_x = (fract(uv.x / 0.25) - 0.5) * 0.25;
	float rivet = max(step(length(vec2(edge.x - 0.035, along_y)), 0.012), step(length(vec2(edge.y - 0.035, along_x)), 0.012));
	float shade = mix(0.9, 1.06, srf_hash(vec3(floor(uv / size), 9.0))) * mix(0.96, 1.03, srf_noise(vec3(uv.x * 40.0, uv.y * 2.0, 0.0)));
	return vec2(mix(0.62, shade, seam) * (1.0 + 0.18 * rivet), seam * 0.8 + rivet * 0.4);
}

vec2 marscrete_tone(vec3 p, vec3 n) {
	vec2 uv = surface_uv(p, n);
	float shade = mix(0.9, 1.06, srf_fbm(p * 0.8)) * mix(0.94, 1.05, srf_noise(p * 14.0));
	shade *= 1.0 - 0.15 * smoothstep(0.82, 0.9, srf_noise(p * 7.0 + 3.0));
	float joint;
	if (abs(n.y) > 0.7) {
		vec2 f = fract(uv / 3.0);
		vec2 e = min(f, 1.0 - f) * 3.0;
		joint = smoothstep(0.0, 0.015, min(e.x, e.y));
		shade *= 1.0 - 0.2 * (1.0 - joint);
	} else {
		float fy = fract(uv.y / 0.6);
		joint = smoothstep(0.0, 0.012, min(fy, 1.0 - fy) * 0.6);
		shade *= 1.0 - 0.1 * (1.0 - joint);
	}
	return vec2(shade, joint);
}

vec2 floor_tone(vec3 p, int kind) {
	vec2 uv = p.xz;
	if (kind == 0) {
		// Planks, 20 cm wide, staggered ends, each its own shade, grain along them.
		vec2 b = uv / vec2(1.8, 0.2);
		b.x += srf_hash(vec3(floor(b.y), 1.0, 2.0)) * 3.0;
		vec2 f = fract(b);
		float gap = step(0.03, f.y) * step(0.004, f.x);
		float grain = mix(0.94, 1.04, srf_noise(vec3(uv.x * 3.0, uv.y * 60.0, 0.0)));
		return vec2(mix(0.55, mix(0.85, 1.08, srf_hash(vec3(floor(b), 4.0))) * grain, gap), gap);
	}
	if (kind == 1) {
		// Tiles, 40 cm, with grout.
		vec2 f = fract(uv / 0.4);
		float grout = step(0.035, f.x) * step(0.035, f.y);
		return vec2(mix(0.72, mix(0.94, 1.04, srf_hash(vec3(floor(uv / 0.4), 6.0))) * mix(0.97, 1.02, srf_noise(p * 8.0)), grout), grout);
	}
	if (kind == 2) {
		// Diamond plate in 2 m sheets.
		vec2 d = uv * 6.0;
		float plate = abs(fract(d.x + d.y) - 0.5) + abs(fract(d.x - d.y) - 0.5);
		float seams = step(0.02, fract(uv.x / 2.0)) * step(0.02, fract(uv.y / 2.0));
		float raised = smoothstep(0.35, 0.6, plate);
		return vec2(mix(0.7, mix(0.95, 1.08, raised), seams), seams * (0.6 + 0.4 * raised));
	}
	if (kind == 3) {
		// Paving: stones in offset rows of 60 cm.
		vec2 b = uv / vec2(0.8, 0.6);
		b.x += 0.5 * mod(floor(b.y), 2.0);
		vec2 f = fract(b);
		float joint = step(0.05, f.x) * step(0.06, f.y) * step(f.x, 0.97) * step(f.y, 0.96);
		float lumpy = srf_noise(p * 3.0);
		return vec2(mix(0.68, mix(0.86, 1.08, srf_hash(vec3(floor(b), 8.0))) * mix(0.93, 1.05, lumpy), joint), joint * (0.8 + 0.2 * lumpy));
	}
	// Concrete: speckled, joints every 3 m.
	vec2 f = fract(uv / 3.0);
	vec2 e = min(f, 1.0 - f) * 3.0;
	float joint = smoothstep(0.0, 0.015, min(e.x, e.y));
	float shade = mix(0.9, 1.06, srf_fbm(p * 0.8)) * mix(0.94, 1.05, srf_noise(p * 14.0));
	return vec2(shade * (1.0 - 0.2 * (1.0 - joint)), joint);
}

// Wear: walls streak and stain toward the floor, floors scuff (the web's grime, 4 m floors under a 3 m crust).
float grime_tone(vec3 p, vec3 n, float level) {
	if (level < 0.5) return 1.0;
	float amount = level / 3.0;
	float above = mod(p.y + 3.0, 4.0);
	if (abs(n.y) > 0.7) {
		float scuff = smoothstep(0.55, 0.8, srf_fbm(p * 1.3)) * 0.5 + smoothstep(0.75, 0.85, srf_noise(p * 3.1)) * 0.4;
		return 1.0 - 0.28 * amount * scuff;
	}
	float rise = (1.0 - smoothstep(0.0, 1.4, above)) * mix(0.6, 1.2, srf_fbm(p * 0.9));
	float streak = smoothstep(0.62, 0.8, srf_noise(vec3(p.x * 3.0, p.y * 0.25, p.z * 3.0))) * (1.0 - smoothstep(2.0, 3.8, above));
	float stain = smoothstep(0.7, 0.82, srf_fbm(p * 0.6 + 4.0));
	return 1.0 - amount * (0.3 * rise + 0.2 * streak + 0.18 * stain);
}

void fragment() {
	vec3 n = normalize(wnorm);
	bool is_floor = abs(n.y) > 0.7;
	vec3 color = albedo;
	float rough = roughness;
	float metal = metallic;
	vec2 t = vec2(1.0);
	float relief = 0.6;
	if (look == 1) { t = rock_tone(wpos); relief = 3.0; }
	else if (look == 2) { t = regolith_tone(wpos); relief = 2.0; }
	else if (look == 3) t = marscrete_tone(wpos, n);
	else if (look == 4) t = brick_tone(wpos, n);
	else if (look == 5) t = metal_tone(wpos, n);
	else if (is_floor) {
		// A room's floor: its own colour, tinted by the room's, laid in its kind, with its own sheen.
		t = floor_tone(wpos, floor_kind);
		color = mix(floor_color, albedo, floor_tint);
		rough = floor_roughness;
		metal = floor_metallic;
	} else {
		// A room's walls: its colour, a fine plaster grain.
		float g = srf_noise(wpos * 9.0);
		t = vec2(mix(0.96, 1.03, g), g * 0.3);
		relief = 0.25;
	}
	color *= t.x * grime_tone(wpos, n, grime);
	ALBEDO = color;
	// Gaps hold dust: rougher than the faces.
	ROUGHNESS = clamp(rough + (1.0 - t.y) * 0.25, 0.0, 1.0);
	METALLIC = metal;

	// Relief from the pattern's height, by its screen-space slope (bump mapping without a map).
	float h = t.y * relief * bump * 0.02;
	vec3 dpdx = dFdx(VERTEX);
	vec3 dpdy = dFdy(VERTEX);
	float dhx = dFdx(h);
	float dhy = dFdy(h);
	vec3 r1 = cross(dpdy, NORMAL);
	vec3 r2 = cross(NORMAL, dpdx);
	float det = dot(dpdx, r1);
	if (abs(det) > 1e-9) {
		vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
		NORMAL = normalize(abs(det) * NORMAL - grad);
	}
}
