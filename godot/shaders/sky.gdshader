// The sky, as the web's (render3d/sky3d.ts): by day, butterscotch dust at the horizon deepening to a
// darker tan overhead, with the bluish glow Mars has round its sun; by night, near-black with stars
// coming out; in a dust storm, murk over everything, hiding the sun and stars.
shader_type sky;

uniform vec3 day_horizon : source_color = vec3(0.863, 0.655, 0.478);
uniform vec3 day_zenith : source_color = vec3(0.612, 0.416, 0.298);
uniform vec3 night_horizon : source_color = vec3(0.110, 0.063, 0.086);
uniform vec3 night_zenith : source_color = vec3(0.016, 0.008, 0.031);
uniform vec3 halo : source_color = vec3(0.604, 0.706, 0.847);
uniform vec3 dust_day : source_color = vec3(0.604, 0.416, 0.290);
uniform vec3 dust_night : source_color = vec3(0.102, 0.063, 0.047);
uniform vec3 sun_dir = vec3(0.0, 1.0, 0.0);
/** Daylight 0..1, a storm's hold 0..1, and how bright the whole sky is (for the tone mapping). */
uniform float light = 1.0;
uniform float dust = 0.0;
uniform float exposure = 1.0;
const float STAR_CELLS = 60.0;
const float STAR_DENSITY = 0.08;
const float STARS_BY = 0.35;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void sky() {
	vec3 d = normalize(EYEDIR);
	// Up the sky: quickly out of the horizon's band, then slowly to the zenith.
	float t = pow(clamp(d.y, 0.0, 1.0), 0.45);
	vec3 col = mix(mix(night_horizon, night_zenith, t), mix(day_horizon, day_zenith, t), light);
	// The sun: a bluish halo round it, and the disc.
	float s = max(dot(d, normalize(sun_dir)), 0.0);
	col += halo * pow(s, 24.0) * 0.45 * light;
	col += vec3(1.0, 0.96, 0.9) * smoothstep(0.9990, 0.9996, s) * light * 4.0;
	// Stars: a scattering of sky cells each hold one, a point that fades in as the light goes.
	float dark = 1.0 - smoothstep(0.0, STARS_BY, light);
	if (dark > 0.0 && d.y > 0.0 && !AT_CUBEMAP_PASS) {
		vec3 p = d * STAR_CELLS;
		vec3 cell = floor(p);
		if (hash(cell) > 1.0 - STAR_DENSITY) {
			vec3 at = vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) * 0.6 + 0.2;
			float r = length(fract(p) - at);
			float bright = mix(0.4, 1.0, hash(cell + 9.1));
			col += vec3(0.95, 0.92, 1.0) * (1.0 - smoothstep(0.02, 0.16, r)) * bright * dark * smoothstep(0.0, 0.08, d.y) * 2.0;
		}
	}
	vec3 murk = mix(dust_night, dust_day, light) * (1.05 - 0.15 * t);
	COLOR = mix(col, murk, dust) * exposure;
}
