using System.Collections.Generic;
using Godot;

namespace DowntownMars;

/// <summary>
/// A plain surface for anything in the hole without a look of its own (doors, props, glass, lines, the
/// rig): a colour, roughness and metal, glow, optionally the vertex colours and a fine grain, as a
/// shader so it honours the view (shaders/view.gdshaderinc: the cutaway's cut, walls down). Godot's
/// StandardMaterial3D can't be cut by a plane. One shader per variant (lit or not, opaque or see-through).
/// </summary>
public static class Plain
{
    static readonly Dictionary<string, Shader> Shaders = new();

    public static ShaderMaterial Make(Color color, float roughness = 0.8f, float metallic = 0, bool transparent = false, bool unshaded = false,
        Color? emission = null, float emissionEnergy = 0, bool vertexColors = false, float grain = 0, float specular = 0.5f, bool flat = false)
    {
        var key = $"{transparent}:{unshaded}";
        if (!Shaders.TryGetValue(key, out var shader)) Shaders[key] = shader = new Shader { Code = Code(transparent, unshaded) };
        var m = new ShaderMaterial { Shader = shader };
        m.SetShaderParameter("albedo", color);
        m.SetShaderParameter("roughness", roughness);
        m.SetShaderParameter("metallic", metallic);
        m.SetShaderParameter("specular", specular);
        m.SetShaderParameter("emission", emission ?? Colors.Black);
        m.SetShaderParameter("emission_energy", emissionEnergy);
        m.SetShaderParameter("use_vertex_color", vertexColors);
        m.SetShaderParameter("grain", grain);
        m.SetShaderParameter("flat_shade", flat);
        return m;
    }

    public static void Release() => Shaders.Clear();

    static string Code(bool transparent, bool unshaded) => $@"
shader_type spatial;
render_mode cull_disabled{(unshaded ? ", unshaded" : "")}{(transparent ? ", depth_draw_opaque" : "")};
#include ""res://shaders/view.gdshaderinc""
uniform vec4 albedo : source_color = vec4(1.0);
uniform float roughness = 0.8;
uniform float metallic = 0.0;
uniform float specular = 0.5;
uniform vec3 emission : source_color = vec3(0.0);
uniform float emission_energy = 0.0;
uniform bool use_vertex_color = false;
uniform float grain = 0.0;
uniform bool walls = false;
// Faceted, as three.js's flatShading: each face's own normal.
uniform bool flat_shade = false;
// The land's rock far off (#497, the web's withLandRock): 0 none, 1 weathered, 2 layered in beds. UV.x is how far
// up its landform each vertex stands (0 foot, 1 top).
uniform int land_rock = 0;
// Room outlines: each vertex's room (id + 1, CUSTOM1.z), tinted by its trouble (room_tint) or the hover.
uniform bool room_lines = false;
// Lines lying on a surface (room outlines on wall caps and floors) come this far toward the camera, metres, so they aren't lost in it.
uniform float toward_camera = 0.0;
global uniform sampler2D room_tint : filter_nearest;
global uniform float hover_room;
global uniform float hover_bad;
varying vec3 wpos;
varying flat float room;
varying vec4 vcolor;
varying float vland;
float hash3(vec3 p) {{ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }}
float noise3(vec3 x) {{
	vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}}
float fbm3(vec3 p) {{ float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) {{ v += a * noise3(p); p *= 2.03; a *= 0.5; }} return v; }}
// As the web's landTone (surfaces.ts): beds by height (pale, mid, dark, seams), a dark caprock and a pale talus
// on layered rock; dust where it looks up, dark streaks down steep faces, grain and mottling on all.
vec3 land_tone(vec3 p, vec3 n, float h, bool layered) {{
	float up = abs(n.y);
	vec3 c = vec3(1.0);
	if (layered) {{
		float s = (p.y + (fbm3(p * 0.0025) - 0.5) * 16.0 + dot(p.xz, vec2(0.0055, 0.0032))) / 6.5;
		float r = hash3(vec3(floor(s), 1.7, 9.1));
		vec3 tone = r < 0.3 ? vec3(1.3, 1.2, 1.07) : r < 0.68 ? vec3(1.0) : vec3(0.72, 0.68, 0.66);
		tone *= mix(0.84, 1.0, smoothstep(0.0, 0.07, fract(s)));
		tone = mix(tone, vec3(0.6, 0.56, 0.55), smoothstep(0.9, 0.96, h));
		tone = mix(tone, vec3(1.16, 1.08, 1.0), 1.0 - smoothstep(0.14, 0.24, h));
		c = tone;
	}}
	c = mix(c, vec3(1.24, 1.13, 1.0), smoothstep(0.55, 0.85, up) * 0.85);
	float streak = noise3(vec3(p.x * 0.09, p.y * 0.004, p.z * 0.09));
	c *= mix(1.0, mix(0.84, 1.05, streak), 1.0 - smoothstep(0.3, 0.6, up));
	return c * mix(0.9, 1.07, fbm3(p * 0.05)) * mix(0.94, 1.05, noise3(p * 0.6));
}}
void vertex() {{
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vcolor = COLOR;
	vland = UV.x;
	room = room_lines ? CUSTOM1.z : 0.0;
	if (walls) VERTEX = lower_wall(VERTEX, CUSTOM0, CUSTOM1.xy, CUSTOM2.xyz, CUSTOM3.xyz, (inverse(MODEL_MATRIX) * vec4(CAMERA_POSITION_WORLD, 1.0)).xyz);
	if (toward_camera > 0.0) VERTEX += (inverse(MODEL_MATRIX) * vec4(normalize(CAMERA_POSITION_WORLD - wpos) * toward_camera, 0.0)).xyz;
}}
void fragment() {{
	if (cut_away(wpos) || sliced_away(wpos, FRAGCOORD.xy)) discard;
	if (flat_shade) NORMAL = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	vec3 c = albedo.rgb * (use_vertex_color ? vcolor.rgb : vec3(1.0));
	float alpha = albedo.a;
	if (grain > 0.0) c *= mix(1.0 - 0.08 * grain, 1.0 + 0.03 * grain, noise3(wpos * 4.0));
	if (land_rock > 0) c *= land_tone(wpos, normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz), vland, land_rock > 1);
	if (room > 0.5) {{
		int id = int(room + 0.5) - 1;
		vec4 tint = texelFetch(room_tint, ivec2(id % 256, id / 256), 0);
		if (abs(float(id) - hover_room) < 0.5) c = hover_bad > 0.5 ? vec3(0.878, 0.314, 0.227) : vec3(1.0, 0.886, 0.69);
		else if (tint.a > 0.5) c = tint.rgb;
		if (abs(float(id) - hover_room) < 0.5 || tint.a > 0.5) alpha = 1.0;
	}}
	ALBEDO = c;
	{(unshaded ? "" : "ROUGHNESS = roughness; METALLIC = metallic; SPECULAR = specular;")}
	EMISSION = emission * emission_energy;
	{(transparent ? "ALPHA = alpha;" : "")}
}}
";
}
