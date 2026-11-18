// Shared by the map's two layers of air (globe_haze, globe_veil; MapView.cs), as the web's (ui/Globe.tsx, #499).
uniform vec3 dust : source_color = vec3(0.902, 0.765, 0.627);
uniform vec3 high : source_color = vec3(0.847, 0.902, 0.957);
/// Toward the sun, in the globe's own frame.
uniform vec3 sun_dir = vec3(-0.557, 0.371, 0.743);
varying vec3 v_dir;

void vertex() { v_dir = normalize(VERTEX); }

/// How lit the air is: full on the day side, gone a little past the terminator.
float air_lit() { return smoothstep(-0.25, 0.45, dot(normalize(v_dir), normalize(sun_dir))); }
/// The shell's outward normal, in view space (as the web's interpolated normal).
vec3 air_normal(mat4 view, mat4 model) { return normalize((view * model * vec4(normalize(v_dir), 0.0)).xyz); }
