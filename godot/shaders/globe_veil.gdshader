// A faint veil of dust over the globe's disc toward its edge, softening the limb (MapView.cs, as ui/Globe.tsx).
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
#include "globe_air.gdshaderinc"
uniform float strength = 0.35;

void fragment() {
	ALBEDO = dust;
	ALPHA = pow(1.0 - max(0.0, dot(air_normal(VIEW_MATRIX, MODEL_MATRIX), VIEW)), 4.0) * air_lit() * strength;
}
