import{Ea as e,Gr as t,Hs as n,Us as r,Vs as i,kr as a}from"./three-CRftAvdZ.js";import{t as o}from"./retro-BbDwnn8U.js";var s=o.palette,c=o.base,l=Object.fromEntries(Object.entries(o.presets).map(([e,t])=>[e,{...c,...t}])),u=[`off`,`bayer2`,`bayer4`,`bayer8`,`ps1`],d=` .:-=+*#%@`,f=`dm.retroTuning`,p={...c},m=new Set;function h(e){Object.assign(p,l[e]??c);try{let t=JSON.parse(localStorage.getItem(`${f}.${e}`)??`null`);if(t)for(let e of Object.keys(p))typeof t[e]==typeof p[e]&&(p[e]=t[e])}catch{}}function g(e,t){Object.assign(p,t);try{localStorage.setItem(`${f}.${e}`,JSON.stringify(p))}catch{}for(let e of m)e()}function _(e){return m.add(e),()=>m.delete(e)}function v(e){let t=new URLSearchParams(e).get(`look`);return t&&t in l?t:null}function y(e,t,n){let r=Math.max(1,Math.round(n));return{scale:r,w:Math.max(1,Math.ceil(e/r)),h:Math.max(1,Math.ceil(t/r))}}function b(e){return e<=.04045?e/12.92:((e+.055)/1.055)**2.4}function x(e){let[t,n,r]=S(e).map(b),i=Math.cbrt(.4122214708*t+.5363325363*n+.0514459929*r),a=Math.cbrt(.2119034982*t+.6806995451*n+.1073969566*r),o=Math.cbrt(.0883024619*t+.2817188376*n+.6299787005*r);return[.2104542553*i+.793617785*a-.0040720468*o,1.9779984951*i-2.428592205*a+.4505937099*o,.0259040371*i+.7827717662*a-.808675766*o]}function S(e){let t=parseInt(e,16)||0;return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function C(e,t){let n=e.map(x),r=Math.max(1,Math.min(e.length,Math.round(t))),i=0;n.forEach((e,t)=>e[0]<n[i][0]&&(i=t));let a=[i],o=n.map(e=>w(e,n[i]));for(;a.length<r;){let e=-1;o.forEach((t,n)=>!a.includes(n)&&(e<0||t>o[e])&&(e=n)),a.push(e),n.forEach((t,r)=>o[r]=Math.min(o[r],w(t,n[e])))}return a.map(t=>e[t])}function w(e,t){return(e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2}var T=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;function E(){return{name:`Retro`,defines:{PALETTE_MAX:32,PAINT_MAX:6},uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new i(1,1)},cameraNear:{value:.1},cameraFar:{value:1e3},projectionInverse:{value:new e},cameraWorld:{value:new e},pixelAngle:{value:.001},render:{value:0},outlineOn:{value:1},outlineWidth:{value:1},outline:{value:new r},creaseRange:{value:0},grade:{value:new n(1,1,1)},paint:{value:0},fog:{value:new n},fogColour:{value:new n},mode:{value:0},pattern:{value:2},dither:{value:0},stableDither:{value:0},bits:{value:5},paper:{value:new n},ink:{value:new n},fill:{value:0},grid:{value:0},paletteSize:{value:0},paletteLab:{value:Array.from({length:32},()=>new n)},paletteRgb:{value:Array.from({length:32},()=>new n)}},vertexShader:T,fragmentShader:`
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform mat4 projectionInverse;
      uniform mat4 cameraWorld;
      uniform float pixelAngle;
      uniform int render;
      uniform float outlineOn;
      uniform float outlineWidth;
      uniform vec4 outline;
      uniform float creaseRange;
      uniform vec3 grade;
      uniform float paint;
      uniform vec3 fog;
      uniform vec3 fogColour;
      uniform int mode;
      uniform int pattern;
      uniform float dither;
      uniform float stableDither;
      uniform float bits;
      uniform vec3 paper;
      uniform vec3 ink;
      uniform float fill;
      uniform float grid;
      uniform int paletteSize;
      uniform vec3 paletteLab[PALETTE_MAX];
      uniform vec3 paletteRgb[PALETTE_MAX];
      varying vec2 vUv;

      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
      }

      vec3 worldAt(vec2 uv) {
        vec4 v = projectionInverse * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0);
        return (cameraWorld * vec4(v.xyz / v.w, 1.0)).xyz;
      }

      // A surface's own 2D coordinates: the world plane it faces most.
      vec2 planeOf(vec3 p, vec3 n) {
        vec3 a = abs(n);
        return a.y >= a.x && a.y >= a.z ? p.xz : a.x >= a.z ? p.zy : p.xy;
      }

      // Brush strokes: each pixel takes the mean of whichever of its four corner
      // squares is most even, so flat areas smear and edges stay sharp.
      vec3 kuwahara(vec2 uv, int r) {
        vec2 t = 1.0 / resolution;
        vec3 best = vec3(0.0);
        float bestVar = 1e9;
        for (int q = 0; q < 4; q++) {
          vec2 dir = vec2(q == 1 || q == 3 ? -1.0 : 1.0, q >= 2 ? -1.0 : 1.0);
          vec3 sum = vec3(0.0);
          vec3 sq = vec3(0.0);
          float n = 0.0;
          for (int y = 0; y <= PAINT_MAX; y++) {
            if (y > r) break;
            for (int x = 0; x <= PAINT_MAX; x++) {
              if (x > r) break;
              vec3 s = texture2D(tDiffuse, uv + vec2(float(x), float(y)) * dir * t).rgb;
              sum += s;
              sq += s * s;
              n += 1.0;
            }
          }
          vec3 mean = sum / n;
          vec3 v = sq / n - mean * mean;
          float var = v.r + v.g + v.b;
          if (var < bestVar) { bestVar = var; best = mean; }
        }
        return best;
      }

      // Ordered dither thresholds, 0 to 1, from Bayer matrices.
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

      // The dither offset at this cell, about -0.5 to 0.5.
      float threshold(vec2 px) {
        if (pattern == 1) return bayer2(px) - 0.5 + 1.0 / 8.0;
        if (pattern == 2) return bayer4(px) - 0.5 + 1.0 / 32.0;
        if (pattern == 3) return bayer8(px) - 0.5 + 1.0 / 128.0;
        if (pattern == 4) {
          // The PlayStation's table, in eighths of a step.
          const mat4 table = mat4(-4.0, 0.0, -3.0, 1.0, 2.0, -2.0, 3.0, -1.0, -3.0, 1.0, -4.0, 0.0, 3.0, -1.0, 2.0, -2.0);
          return table[int(mod(px.y, 4.0))][int(mod(px.x, 4.0))] / 8.0;
        }
        return 0.0;
      }

      vec3 toLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
      }
      vec3 toOklab(vec3 c) {
        float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
        float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
        float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
        l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
        return vec3(
          0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
      }

      void main() {
        vec2 px = floor(vUv * resolution);
        float zc = viewZ(vUv);
        bool sky = zc >= cameraFar * 0.98;
        // Where this pixel is in the world, and which way its surface faces (from the neighbours'), for the grid and the pinned dither.
        vec3 world = worldAt(vUv);
        vec3 normal = normalize(cross(dFdx(world), dFdy(world)));
        // How many metres one pixel spans, here.
        float pixelMetres = zc * pixelAngle;

        vec3 c = paint >= 1.0 ? kuwahara(vUv, int(paint)) : texture2D(tDiffuse, vUv).rgb;

        // Brightness, contrast and saturation.
        c *= grade.x;
        c = (c - 0.5) * grade.y + 0.5;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(luma), c, grade.z), 0.0, 1.0);

        // Distance fog (the sky takes it in full).
        if (fog.x > 0.0) c = mix(c, fogColour, fog.x * (sky ? 1.0 : smoothstep(fog.y, fog.z, zc)));

        // Edges: 1 the near side of a jump in depth (a silhouette), 0.5 where a surface bends (a crease).
        float edge = 0.0;
        if ((outlineOn > 0.5 || render == 1) && !sky) {
          vec2 t = outlineWidth / resolution;
          float zl = viewZ(vUv - vec2(t.x, 0.0)), zr = viewZ(vUv + vec2(t.x, 0.0));
          float zd = viewZ(vUv - vec2(0.0, t.y)), zu = viewZ(vUv + vec2(0.0, t.y));
          float far = max(max(zl, zr), max(zd, zu));
          float near = min(min(zl, zr), min(zd, zu));
          if ((far - zc) / zc > outline.x) {
            edge = 1.0;
          } else if (outline.y > 0.0 && (zc - near) / zc <= outline.x && zc < creaseRange) {
            // 1/depth is flat across a flat surface, so its curvature finds the creases.
            float ic = 1.0 / zc;
            float bend = (abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic)) / ic;
            if (bend > outline.y) edge = 0.5;
          }
        }

        if (render == 1) {
          // Lines: ink on paper, a little of the scene's shading, and a grid on the world's surfaces.
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 base = mix(paper, mix(paper, ink, lum), fill);
          float g = 0.0;
          if (grid > 0.0 && !sky) {
            vec2 p = planeOf(world, normal);
            vec2 f = abs(fract(p / grid + 0.5) - 0.5) * grid;
            g = step(min(f.x, f.y), pixelMetres * outlineWidth * 0.5) * 0.35;
          }
          gl_FragColor = vec4(mix(base, ink, max(edge >= 1.0 ? 1.0 : edge * 1.2, g)), 1.0);
          return;
        }

        if (edge >= 1.0) c *= outline.z;
        else if (edge > 0.0) c *= outline.w;

        if (mode != 0) {
          // Dither, pinned to the screen, or to the world: there, cells a power of two metres across, about a pixel each.
          vec2 cell = px;
          if (stableDither > 0.5 && !sky) cell = floor(planeOf(world, normal) / exp2(ceil(log2(max(pixelMetres, 1e-4)))));
          c = clamp(c + threshold(cell) * dither, 0.0, 1.0);
          if (mode == 2) {
            float levels = exp2(bits) - 1.0;
            c = floor(c * levels + 0.5) / levels;
          } else if (paletteSize > 0) {
            vec3 lab = toOklab(toLinear(c));
            float best = 1e9;
            vec3 pick = c;
            for (int i = 0; i < PALETTE_MAX; i++) {
              if (i >= paletteSize) break;
              vec3 d = lab - paletteLab[i];
              float e = dot(d, d);
              if (e < best) { best = e; pick = paletteRgb[i]; }
            }
            c = pick;
          }
        }
        gl_FragColor = vec4(c, 1.0);
      }`}}var D=null;function O(){if(D)return D;let e=document.createElement(`canvas`);e.width=320,e.height=32;let n=e.getContext(`2d`);return n.fillStyle=`#000`,n.fillRect(0,0,e.width,e.height),n.fillStyle=`#fff`,n.font=`bold 28.8px ui-monospace, Menlo, monospace`,n.textAlign=`center`,n.textBaseline=`middle`,[...d].forEach((e,t)=>n.fillText(e,t*32+16,17)),D=new t(e),D.colorSpace=``,D}function k(){return{name:`RetroUpscale`,uniforms:{tDiffuse:{value:null},lowSize:{value:new i(1,1)},screen:{value:new i(1,1)},scale:{value:1},smoothing:{value:0},ascii:{value:0},asciiMono:{value:0},glyphs:{value:null},glyphCount:{value:10},paper:{value:new n},ink:{value:new n},crt:{value:0},curvature:{value:0},scanlines:{value:0},mask:{value:0},aberration:{value:0},glow:{value:0},vignette:{value:0}},vertexShader:T,fragmentShader:`
      uniform sampler2D tDiffuse;
      uniform vec2 lowSize;
      uniform vec2 screen;
      uniform float scale;
      uniform float smoothing;
      uniform float ascii;
      uniform float asciiMono;
      uniform sampler2D glyphs;
      uniform float glyphCount;
      uniform vec3 paper;
      uniform vec3 ink;
      uniform float crt;
      uniform float curvature;
      uniform float scanlines;
      uniform float mask;
      uniform float aberration;
      uniform float glow;
      uniform float vignette;
      varying vec2 vUv;

      vec3 texel(vec2 i) { return texture2D(tDiffuse, (i + 0.5) / lowSize).rgb; }

      // The picture at this screen pixel: its block, or blended between blocks.
      vec3 picture(vec2 sp) {
        vec2 tc = sp / scale;
        if (smoothing < 0.5) return texel(floor(tc));
        vec2 b = tc - 0.5;
        vec2 i = floor(b);
        vec2 f = fract(b);
        return mix(mix(texel(i), texel(i + vec2(1.0, 0.0)), f.x), mix(texel(i + vec2(0.0, 1.0)), texel(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      // The same, or as a character: the block's brightness picks it, in the block's colour or in ink.
      vec3 shade(vec2 sp) {
        if (ascii < 0.5) return picture(sp);
        vec2 tc = sp / scale;
        vec3 col = texel(floor(tc));
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        // On a curve, so the dim mid-tones of a lamp-lit hole still get the fuller characters.
        float idx = min(floor(pow(lum, 0.6) * glyphCount), glyphCount - 1.0);
        vec2 inCell = fract(tc);
        float a = texture2D(glyphs, vec2((idx + inCell.x) / glyphCount, inCell.y)).r;
        vec3 fg = asciiMono > 0.5 ? ink : col / max(max(col.r, max(col.g, col.b)), 0.25);
        return mix(paper, fg, a);
      }

      void main() {
        vec2 uv = vUv;
        vec2 q = uv * 2.0 - 1.0;
        if (crt > 0.5) {
          // The glass bulges: push the picture out towards the corners, and black beyond its edge.
          q *= 1.0 + curvature * dot(q, q);
          if (abs(q.x) > 1.0 || abs(q.y) > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          uv = q * 0.5 + 0.5;
        }
        vec2 sp = uv * screen;
        vec3 c;
        if (crt > 0.5 && aberration > 0.0) {
          vec2 o = vec2(aberration * scale * 0.5, 0.0);
          c = vec3(shade(sp + o).r, shade(sp).g, shade(sp - o).b);
        } else {
          c = shade(sp);
        }
        if (crt > 0.5) {
          if (glow > 0.0) {
            float r = 1.5 * max(scale, 2.0);
            vec3 g = (shade(sp + vec2(r, r)) + shade(sp + vec2(-r, r)) + shade(sp + vec2(r, -r)) + shade(sp - vec2(r, r))
              + shade(sp + vec2(2.0 * r, 0.0)) + shade(sp - vec2(2.0 * r, 0.0)) + shade(sp + vec2(0.0, 2.0 * r)) + shade(sp - vec2(0.0, 2.0 * r))) / 8.0;
            c += g * glow;
          }
          // Scanlines, one to a row of blocks (at least every few screen pixels).
          float row = fract(sp.y / max(scale, 3.0));
          c *= 1.0 - scanlines * (1.0 - sin(row * 3.14159));
          // The phosphor mask: red, green and blue stripes, a screen pixel each.
          float col = mod(floor(gl_FragCoord.x), 3.0);
          vec3 m = col < 1.0 ? vec3(1.0, 0.4, 0.4) : col < 2.0 ? vec3(0.4, 1.0, 0.4) : vec3(0.4, 0.4, 1.0);
          c *= mix(vec3(1.0), m, mask) * (1.0 + mask * 0.8);
          c *= 1.0 - vignette * dot(q, q) * 0.5;
        }
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`}}function A(e,t,n){let r=(e,t)=>e.value.set(...S(t));e.render.value=+(n.render===`lines`),e.outlineOn.value=+!!n.outlines,e.outlineWidth.value=n.outlineWidth,e.outline.value.set(n.silhouette,n.crease,n.silhouetteDark,n.creaseDark),e.creaseRange.value=n.creaseRange,e.grade.value.set(n.brightness,n.contrast,n.saturation),e.paint.value=n.paint,e.fog.value.set(n.fog,n.fogNear,Math.max(n.fogFar,n.fogNear+1)),r(e.fogColour,n.fogColour),e.mode.value=n.colours===`palette`?1:n.colours===`bits`?2:0,e.pattern.value=Math.max(0,u.indexOf(n.pattern)),e.dither.value=n.dither,e.stableDither.value=+!!n.stableDither,e.bits.value=n.bits,r(e.paper,n.paper),r(e.ink,n.ink),e.fill.value=n.fill,e.grid.value=n.grid;let i=C(s,n.paletteSize);e.paletteSize.value=i.length;let a=e.paletteLab.value,o=e.paletteRgb.value;i.forEach((e,t)=>{a[t].set(...x(e)),o[t].set(...S(e))}),t.smoothing.value=+!!n.smooth,t.ascii.value=+!!n.ascii,t.asciiMono.value=+!!n.asciiMono,n.ascii&&!t.glyphs.value&&(t.glyphs.value=O()),r(t.paper,n.paper),r(t.ink,n.ink),t.crt.value=+!!n.crt,t.curvature.value=n.curvature,t.scanlines.value=n.scanlines,t.mask.value=n.mask,t.aberration.value=n.aberration,t.glow.value=n.glow,t.vignette.value=n.vignette}var j=!1;function M(e){if(e<=0||j)return;j=!0;let t=(e/2).toFixed(1);a.project_vertex+=`
    gl_Position.xy = floor(gl_Position.xy / gl_Position.w * ${t} + 0.5) / ${t} * gl_Position.w;`}var N=!1;function P(e){if(e<=0||N)return;N=!0;let t=`vec3 irradiance = dotNL * directLight.color;`,n=Math.round(e).toFixed(1),r=`${t}
    { float il = max(max(irradiance.r, irradiance.g), irradiance.b);
      if (il > 0.0) irradiance *= (floor(il * ${n} + 0.35) / ${n}) / il; }`,i=a;for(let e of[`lights_physical_pars_fragment`,`lights_lambert_pars_fragment`,`lights_phong_pars_fragment`])i[e]=i[e].replace(t,r)}export{h as a,y as c,p as d,g as f,P as i,E as l,k as m,l as n,_ as o,M as p,A as r,C as s,s as t,v as u};