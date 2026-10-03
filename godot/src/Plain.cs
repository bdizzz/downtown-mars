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
varying vec3 wpos;
varying vec4 vcolor;
float hash3(vec3 p) {{ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }}
float noise3(vec3 x) {{
	vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}}
void vertex() {{
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vcolor = COLOR;
	if (walls) VERTEX = lower_wall(VERTEX, CUSTOM0, CUSTOM1.xy, wpos, CAMERA_POSITION_WORLD);
}}
void fragment() {{
	if (cut_away(wpos)) discard;
	if (flat_shade) NORMAL = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	vec3 c = albedo.rgb * (use_vertex_color ? vcolor.rgb : vec3(1.0));
	if (grain > 0.0) c *= mix(1.0 - 0.08 * grain, 1.0 + 0.03 * grain, noise3(wpos * 4.0));
	ALBEDO = c;
	{(unshaded ? "" : "ROUGHNESS = roughness; METALLIC = metallic; SPECULAR = specular;")}
	EMISSION = emission * emission_energy;
	{(transparent ? "ALPHA = albedo.a;" : "")}
}}
";
}
