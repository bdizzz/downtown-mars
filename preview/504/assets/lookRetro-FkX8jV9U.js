import{Xr as e,dc as t,lc as n,uc as r}from"./three-ZT0iBgqa.js";var i={_doc:`Retro looks for the 3D view (#503), an experiment behind ?look=snes or ?look=ps1 (src/render3d/lookRetro.ts), tuned live in its panel. pixel: CSS pixels per chunky pixel (rounded to whole screen pixels); colours: 'palette' (the nearest of the first paletteSize colours picked from palette, in OKLab) or 'bits' (bits per channel); dither: the dither's spread in sRGB (0 to 1); pattern: off, bayer2, bayer4, bayer8 or ps1 (the PlayStation's 4x4 table); outlines: dark lines where depth jumps (silhouette: how far behind the neighbour must be, as a share of the distance) or bends (crease, on 1/depth, 0 off, drawn to creaseRange metres), and how dark each makes the pixel; brightness, contrast, saturation: applied before the colours are reduced; wobble: snap vertices to a coarse screen grid, this many steps across the screen's height (0 off; takes effect on reload).`,palette:`0e0a0c.1f1418.2e1c1c.45282a.5e3a2c.7a4a32.9a5a36.b8703c.d48a4a.e8a862.f4c88a.fbe6c0.fff8ec.6a1e1e.9c2e22.c84a2e.5a2a3e.8a4a5a.c08a8a.1e3a2a.3a6a3a.6a9a4a.a8c86a.1a2440.2c4068.4a6a9a.7aa0c8.b8d4e8.4a4448.7a7276.aaa2a0.ffd84a`.split(`.`),presets:{snes:{pixel:4,colours:`palette`,paletteSize:32,bits:5,dither:.09,pattern:`bayer4`,outlines:!0,silhouette:.05,crease:.04,silhouetteDark:.22,creaseDark:.6,creaseRange:150,brightness:1.15,contrast:1,saturation:1.1,wobble:0},ps1:{pixel:4,colours:`bits`,paletteSize:32,bits:5,dither:.031,pattern:`ps1`,outlines:!1,silhouette:.05,crease:0,silhouetteDark:.22,creaseDark:.6,creaseRange:150,brightness:1.1,contrast:1,saturation:1,wobble:120}}},a=i.palette,o=i.presets,s=[`off`,`bayer2`,`bayer4`,`bayer8`,`ps1`],c=`dm.retroTuning`,l={...o.snes},u=new Set;function d(e){Object.assign(l,o[e]);try{let t=JSON.parse(localStorage.getItem(`${c}.${e}`)??`null`);if(t)for(let e of Object.keys(l))typeof t[e]==typeof l[e]&&(l[e]=t[e])}catch{}}function f(e,t){Object.assign(l,t);try{localStorage.setItem(`${c}.${e}`,JSON.stringify(l))}catch{}for(let e of u)e()}function p(e){return u.add(e),()=>u.delete(e)}function m(e){let t=new URLSearchParams(e).get(`look`);return t===`snes`||t===`ps1`?t:null}function h(e,t,n){let r=Math.max(1,Math.round(n));return{scale:r,w:Math.max(1,Math.ceil(e/r)),h:Math.max(1,Math.ceil(t/r))}}function g(e){return e<=.04045?e/12.92:((e+.055)/1.055)**2.4}function _(e){let t=parseInt(e,16),n=g((t>>16&255)/255),r=g((t>>8&255)/255),i=g((t&255)/255),a=Math.cbrt(.4122214708*n+.5363325363*r+.0514459929*i),o=Math.cbrt(.2119034982*n+.6806995451*r+.1073969566*i),s=Math.cbrt(.0883024619*n+.2817188376*r+.6299787005*i);return[.2104542553*a+.793617785*o-.0040720468*s,1.9779984951*a-2.428592205*o+.4505937099*s,.0259040371*a+.7827717662*o-.808675766*s]}function v(e,t){let n=e.map(_),r=Math.max(1,Math.min(e.length,Math.round(t))),i=0;n.forEach((e,t)=>e[0]<n[i][0]&&(i=t));let a=[i],o=n.map(e=>y(e,n[i]));for(;a.length<r;){let e=-1;o.forEach((t,n)=>!a.includes(n)&&(e<0||t>o[e])&&(e=n)),a.push(e),n.forEach((t,r)=>o[r]=Math.min(o[r],y(t,n[e])))}return a.map(t=>e[t])}function y(e,t){return(e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2}var b=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;function x(){return{name:`Retro`,defines:{PALETTE_MAX:32},uniforms:{tDiffuse:{value:null},tDepth:{value:null},resolution:{value:new n(1,1)},cameraNear:{value:.1},cameraFar:{value:1e3},outlineOn:{value:1},outline:{value:new t},creaseRange:{value:0},grade:{value:new r(1,1,1)},mode:{value:0},pattern:{value:2},dither:{value:0},bits:{value:5},paletteSize:{value:0},paletteLab:{value:Array.from({length:32},()=>new r)},paletteRgb:{value:Array.from({length:32},()=>new r)}},vertexShader:b,fragmentShader:`
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform float outlineOn;
      uniform vec4 outline;
      uniform float creaseRange;
      uniform vec3 grade;
      uniform int mode;
      uniform int pattern;
      uniform float dither;
      uniform float bits;
      uniform int paletteSize;
      uniform vec3 paletteLab[PALETTE_MAX];
      uniform vec3 paletteRgb[PALETTE_MAX];
      varying vec2 vUv;

      float viewZ(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
      }

      // Ordered dither thresholds, 0 to 1, from Bayer matrices.
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

      // The dither offset for this pixel, about -0.5 to 0.5.
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
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 px = floor(vUv * resolution);

        // Brightness, contrast and saturation, before the colours are reduced.
        c *= grade.x;
        c = (c - 0.5) * grade.y + 0.5;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        c = clamp(mix(vec3(luma), c, grade.z), 0.0, 1.0);

        if (outlineOn > 0.5) {
          vec2 t = 1.0 / resolution;
          float zc = viewZ(vUv);
          if (zc < cameraFar * 0.98) {
            float zl = viewZ(vUv - vec2(t.x, 0.0)), zr = viewZ(vUv + vec2(t.x, 0.0));
            float zd = viewZ(vUv - vec2(0.0, t.y)), zu = viewZ(vUv + vec2(0.0, t.y));
            float far = max(max(zl, zr), max(zd, zu));
            float near = min(min(zl, zr), min(zd, zu));
            if ((far - zc) / zc > outline.x) {
              // The near side of a jump in depth: a silhouette.
              c *= outline.z;
            } else if (outline.y > 0.0 && (zc - near) / zc <= outline.x && zc < creaseRange) {
              // Where a surface bends: 1/depth is flat across a flat surface, so its curvature finds the creases.
              float ic = 1.0 / zc;
              float bend = (abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic)) / ic;
              if (bend > outline.y) c *= outline.w;
            }
          }
        }

        c = clamp(c + threshold(px) * dither, 0.0, 1.0);
        if (mode == 1) {
          // So many bits a channel, rounded to the nearest level.
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
        gl_FragColor = vec4(c, 1.0);
      }`}}function S(e,t){e.outlineOn.value=+!!t.outlines,e.outline.value.set(t.silhouette,t.crease,t.silhouetteDark,t.creaseDark),e.creaseRange.value=t.creaseRange,e.grade.value.set(t.brightness,t.contrast,t.saturation),e.mode.value=+(t.colours===`bits`),e.pattern.value=Math.max(0,s.indexOf(t.pattern)),e.dither.value=t.dither,e.bits.value=t.bits;let n=v(a,t.paletteSize);e.paletteSize.value=n.length;let r=e.paletteLab.value,i=e.paletteRgb.value;n.forEach((e,t)=>{r[t].set(..._(e));let n=parseInt(e,16);i[t].set((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)})}var C={name:`RetroUpscale`,uniforms:{tDiffuse:{value:null},uvScale:{value:new n(1,1)}},vertexShader:b,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 uvScale;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(texture2D(tDiffuse, vUv * uvScale).rgb, 1.0);
    }`},w=!1;function T(t){if(t<=0||w)return;w=!0;let n=(t/2).toFixed(1);e.project_vertex+=`
    gl_Position.xy = floor(gl_Position.xy / gl_Position.w * ${n} + 0.5) / ${n} * gl_Position.w;`}export{d as a,h as c,l as d,f,S as i,x as l,o as n,p as o,T as p,C as r,v as s,a as t,m as u};