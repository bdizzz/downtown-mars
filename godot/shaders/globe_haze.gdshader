// The atmosphere's band of haze on the limb (MapView.cs, as ui/Globe.tsx): a shell a little over the ground, seen
// from inside its back, 0 at the shell's own silhouette and rising to the planet's limb; dust low down turning to
// the pale blue-white of the ice hazes higher up; lit only on the sunward side.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_front, shadows_disabled, fog_disabled;
#include "globe_air.gdshaderinc"
/// sqrt(1 − 1/(1 + thickness)²): how far across the shell's back the planet's limb falls.
uniform float edge = 0.2194;
uniform float glow = 1.05;

void fragment() {
	float g = max(0.0, -dot(air_normal(VIEW_MATRIX, MODEL_MATRIX), VIEW)) / edge;
	float alt = 1.0 - clamp(g, 0.0, 1.0);
	ALBEDO = mix(dust, high, smoothstep(0.05, 0.6, alt));
	ALPHA = pow(1.0 - alt, 1.6) * air_lit() * glow;
}
