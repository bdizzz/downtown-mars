import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Touches } from "../view/touch";

// The planet as a globe, from real data (#499): its colour (USGS's Viking mosaic, shaded by MOLA's relief,
// data/mars-relief.jpg) on a sphere raised by its heights (MOLA, public/map/height.png, exaggerated so they
// show) and lit; sharper tiles (public/map/tiles/, 32 px a degree) laid over the part in view as you zoom in;
// the IAU's names, the biggest that fit at each zoom, as labels; and over it all, what the game draws (the
// map canvas: deposits, holes, convoys, routes). All made by scripts/build-map.py and build-names.mjs.
// Drag to spin it; let go and it coasts, slowing to a stop. Scroll to zoom. Pointing and clicking find the
// latitude and longitude under the pointer, on the raised ground.

export type LatLon = { lat: number; lon: number };

const GLOBE = {
  /** Camera distance, in globe radii: where it starts, and how close and far it goes. */
  distance: { start: 3.7, min: 1.16, max: 6 },
  /** Radians of spin per pixel dragged, and per pixel scrolled sideways (at the starting distance). */
  drag: 0.006,
  scrollSpin: 0.004,
  /** How quickly a coasting spin dies away (per second), and when it counts as stopped. */
  decay: 2.2,
  /** A fling's speed is measured over the drag's last moments (ms), and capped (radians a second). */
  window: 100,
  maxSpeed: 6,
  rest: 0.0005,
  /** The farthest the poles tip toward you. */
  maxTilt: (80 * Math.PI) / 180,
  /** A press that moves more than this (pixels) is a drag, not a click. */
  clickSlop: 5,
  /**
   * The atmosphere (#499): how thick its haze band looks (in radii: Mars's dust and ice hazes reach some 50 km,
   * 1.5%, shown a little thicker), its dust low down and its ice hazes higher up, how bright the band, and the
   * veil of dust over the disc's edge.
   */
  atmosphere: { thickness: 0.025, dust: 0xe6c3a0, high: 0xd8e6f4, glow: 1.05, veil: 0.35 },
  /**
   * The relief: how much the heights are exaggerated (a radius is 3,396 km, so Olympus Mons' 21 km would be
   * a 0.6% bump), and the height map's range (metres, its 0 and 255; as build-map.py writes it).
   */
  relief: { exaggerate: 10, min: -8500, max: 21500, radiusM: 3396190 },
  /** The tiles: how many degrees each covers and the grid of them, from what distance they're laid on, and how many to keep loaded. */
  tiles: { deg: 15, rows: 12, cols: 24, within: 2.7, keep: 80 },
  /** The names: how big on screen (px) a feature must be to be named, the most at once, and their fonts. */
  names: { minPx: 40, most: 30 },
};

/** Big regions get the wide-spaced capitals of a map's regional names. */
const REGION_KINDS = new Set(["terra", "planitia", "planum", "vastitas", "palus"]);

type Name = { name: string; kind: string; km: number; lat: number; lon: number };

/**
 * The globe's surface shader: each vertex lifted by the height there (read from the height map at its own
 * latitude and longitude, so the sphere, the tiles and the overlay all follow the same ground), and each
 * pixel's normal tilted by the height map's slopes, so the relief catches the light.
 */
function withRelief<T extends THREE.Material>(m: T, u: { height: { value: THREE.Texture | null }; on: { value: number } }, lift: number): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { reliefHeight: u.height, reliefOn: u.on });
    const common = /* glsl */ `
      uniform sampler2D reliefHeight;
      uniform float reliefOn;
      const float RELIEF_SCALE = ${(((GLOBE.relief.max - GLOBE.relief.min) / GLOBE.relief.radiusM) * GLOBE.relief.exaggerate).toFixed(6)};
      const float RELIEF_ZERO = ${(-GLOBE.relief.min / (GLOBE.relief.max - GLOBE.relief.min)).toFixed(6)};
      vec2 reliefUv(vec3 d) {
        float lon = atan(d.z, -d.x);
        return vec2(fract(lon / 6.2831853), asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
      }
      float reliefAt(vec2 uv) { return (texture2D(reliefHeight, uv).r - RELIEF_ZERO) * RELIEF_SCALE * reliefOn; }
    `;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${common}\nvarying vec3 vReliefDir;\nvarying vec3 vReliefUp;\nvarying vec3 vReliefEast;\nvarying vec3 vReliefNorth;`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 rd = normalize(position);
        vReliefDir = rd;
        transformed = rd * (${(1 + lift).toFixed(4)} + reliefAt(reliefUv(rd)));
        vec3 east = normalize(vec3(rd.z, 0.0, -rd.x) + vec3(1e-5, 0.0, 0.0));
        vReliefUp = normalize(normalMatrix * rd);
        vReliefEast = normalize(normalMatrix * east);
        vReliefNorth = normalize(normalMatrix * cross(rd, east));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${common}\nvarying vec3 vReliefDir;\nvarying vec3 vReliefUp;\nvarying vec3 vReliefEast;\nvarying vec3 vReliefNorth;`)
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        {
          vec2 uv = reliefUv(normalize(vReliefDir));
          vec2 px = vec2(1.0 / 1440.0, 1.0 / 720.0);
          float c = max(0.08, cos((uv.y - 0.5) * 3.1415927));
          float gx = (reliefAt(uv + vec2(px.x, 0.0)) - reliefAt(uv - vec2(px.x, 0.0))) / (2.0 * px.x * 6.2831853 * c);
          float gy = (reliefAt(uv + vec2(0.0, px.y)) - reliefAt(uv - vec2(0.0, px.y))) / (2.0 * px.y * 3.1415927);
          normal = normalize(vReliefUp - gx * vReliefEast - gy * vReliefNorth);
        }`,
      );
  };
  m.customProgramCacheKey = () => `relief-${lift}`;
  return m;
}

interface Props {
  /** The planet's own picture (data/mars-relief.jpg): 2:1, longitude 0 at the left edge, north at the top. */
  relief: HTMLCanvasElement;
  /** What the game draws over it, the same shape, transparent elsewhere. */
  map: HTMLCanvasElement;
  /** Bumped whenever the map canvas has been redrawn. */
  version: number;
  /** Where to face when it opens. */
  focus: LatLon;
  onHover: (at: LatLon | null) => void;
  onPick: (at: LatLon) => void;
}

/** The spin that brings a place to the middle, facing the camera: yaw about the axis, then tilt. */
function facing(at: LatLon): { yaw: number; tilt: number } {
  return { yaw: Math.PI / 2 - (at.lon * Math.PI) / 180, tilt: (at.lat * Math.PI) / 180 };
}

export function Globe({ relief, map, version, focus, onHover, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const redraw = useRef<() => void>(() => {});
  const callbacks = useRef({ onHover, onPick });
  callbacks.current = { onHover, onPick };

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.AmbientLight(0xffe8d8, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2e0, 1.6);
    sun.position.set(-3, 2, 4);
    scene.add(sun);

    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    // The heights, for the relief: on once loaded (the globe is a plain ball till then), and read here too, for pointing.
    const reliefU = { height: { value: null as THREE.Texture | null }, on: { value: 0 } };
    let heights: { data: Uint8ClampedArray; w: number; h: number } | null = null;
    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}map/height.png`, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      reliefU.height.value = tex;
      reliefU.on.value = 1;
      const img = tex.image as HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      heights = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
      dirty = true;
    });
    const planet = new THREE.CanvasTexture(relief);
    planet.colorSpace = THREE.SRGBColorSpace;
    planet.anisotropy = anisotropy;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 384, 192), withRelief(new THREE.MeshStandardMaterial({ map: planet, roughness: 1 }), reliefU, 0));
    globe.rotation.order = "XYZ";
    scene.add(globe);
    // What the game draws, just above the ground and following it.
    const texture = new THREE.CanvasTexture(map);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    textureRef.current = texture;
    const overlay = new THREE.Mesh(
      new THREE.SphereGeometry(1, 384, 192),
      withRelief(new THREE.MeshStandardMaterial({ map: texture, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), reliefU, 0.0016),
    );
    globe.add(overlay);

    // The tiles: a patch of sphere each, laid over the part in view once you're close enough.
    const T = GLOBE.tiles;
    const tileMat = new Map<string, THREE.MeshStandardMaterial>();
    const tileMesh = new Map<string, THREE.Mesh>();
    const loading = new Set<string>();
    const used: string[] = [];
    // Each tile's patch is made where it lies (the relief reads each vertex's own latitude and longitude).
    const tileGeo = new Map<string, THREE.SphereGeometry>();
    const geoFor = (key: string, row: number, col: number) => {
      let g = tileGeo.get(key);
      if (!g) {
        const d = (T.deg * Math.PI) / 180;
        g = new THREE.SphereGeometry(1, 24, 24, col * d, d, row * d, d);
        tileGeo.set(key, g);
      }
      return g;
    };
    const centre = new THREE.Vector3();
    const updateTiles = () => {
      const near = spin.distance < T.within;
      globe.updateMatrixWorld();
      // How far round the sphere you can see from here, and a margin.
      const reach = Math.acos(Math.min(1, 1 / spin.distance)) + 0.25;
      const want = new Set<string>();
      if (near) {
        for (let row = 0; row < T.rows; row++) {
          for (let col = 0; col < T.cols; col++) {
            const lat = ((90 - (row + 0.5) * T.deg) * Math.PI) / 180;
            const lon = (((col + 0.5) * T.deg) * Math.PI) / 180;
            centre.set(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)).applyMatrix4(globe.matrixWorld);
            // Facing the camera (on +z), within what can be seen, with the tile's own half-width.
            if (Math.acos(Math.max(-1, Math.min(1, centre.z))) < reach + 0.19) want.add(`${row}_${col}`);
          }
        }
      }
      for (const [key, mesh] of tileMesh) {
        if (!want.has(key)) {
          globe.remove(mesh);
          tileMesh.delete(key);
        }
      }
      for (const key of want) {
        if (tileMesh.has(key)) continue;
        const mat = tileMat.get(key);
        const [row, col] = key.split("_").map(Number) as [number, number];
        if (mat) {
          const mesh = new THREE.Mesh(geoFor(key, row, col), mat);
          globe.add(mesh);
          tileMesh.set(key, mesh);
          continue;
        }
        if (loading.has(key)) continue;
        loading.add(key);
        new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}map/tiles/${key}.jpg`, (tex) => {
          loading.delete(key);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = anisotropy;
          tileMat.set(key, withRelief(new THREE.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), reliefU, 0.0006));
          used.push(key);
          // Keep the most recent; let the oldest go.
          while (used.length > T.keep) {
            const old = used.shift()!;
            if (tileMesh.has(old) || want.has(old)) continue;
            const m = tileMat.get(old);
            m?.map?.dispose();
            m?.dispose();
            tileMat.delete(old);
            tileGeo.get(old)?.dispose();
            tileGeo.delete(old);
          }
          dirty = true;
          tilesDirty = true;
        });
      }
    };
    let tilesDirty = true;

    // The names: labels over the globe, the biggest that fit at this zoom and face you, none overlapping.
    const nameLayer = document.createElement("div");
    nameLayer.className = "globe-names";
    el.appendChild(nameLayer);
    let names: Name[] = [];
    import("../../data/mars-names.json").then((mod) => {
      names = ((mod.default ?? mod) as { names: Name[] }).names;
      dirty = true;
    });
    const pool: HTMLSpanElement[] = [];
    const at = new THREE.Vector3();
    const updateNames = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const focal = h / 2 / Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const height = spin.distance - 1;
      const boxes: [number, number, number, number][] = [];
      let n = 0;
      for (const f of names) {
        if (n >= GLOBE.names.most) break;
        const px = ((f.km / 2 / 3389.5) * focal) / height;
        if (px < GLOBE.names.minPx) break;
        const lat = (f.lat * Math.PI) / 180;
        const lon = (f.lon * Math.PI) / 180;
        at.set(-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)).applyMatrix4(globe.matrixWorld);
        if (at.z < 0.25) continue;
        at.project(camera);
        const x = (at.x * 0.5 + 0.5) * w;
        const y = (-at.y * 0.5 + 0.5) * h;
        if (x < 0 || y < 0 || x > w || y > h) continue;
        const region = REGION_KINDS.has(f.kind);
        const bw = f.name.length * (region ? 9 : 7) + 10;
        const box: [number, number, number, number] = [x - bw / 2, y - 9, x + bw / 2, y + 9];
        if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        boxes.push(box);
        const span = pool[n] ?? nameLayer.appendChild(document.createElement("span"));
        pool[n] = span;
        span.textContent = f.name;
        span.className = region ? "region" : "";
        span.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        span.style.display = "";
        n++;
      }
      for (let i = n; i < pool.length; i++) pool[i]!.style.display = "none";
    };
    // The atmosphere, as Mars's looks from orbit: a thin band of haze hugging the limb, butterscotch dust low
    // down turning to the pale blue-white of the ice hazes higher up, lit only where the sun reaches and fading
    // out over the night side; and a faint veil of dust over the disc toward its edge, softening the limb.
    const A = GLOBE.atmosphere;
    const sunward = sun.position.clone().normalize();
    const airVertex = `varying vec3 vN; varying vec3 vV; varying vec3 vDir;
      void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz);
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * mv; }`;
    const airUniforms = { dust: { value: new THREE.Color(A.dust) }, high: { value: new THREE.Color(A.high) }, sun: { value: sunward } };
    // How lit the air is: full on the day side, gone a little past the terminator.
    const lit = `float lit = smoothstep(-0.25, 0.45, dot(vDir, sun));`;
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(1 + A.thickness, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: airUniforms,
        vertexShader: airVertex,
        // Seen from inside the shell's back: 0 at the shell's own silhouette, rising to the planet's limb.
        fragmentShader: `uniform vec3 dust; uniform vec3 high; uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vDir;
          void main() {
            ${lit}
            float g = max(0.0, -dot(vN, vV)) / ${Math.sqrt(1 - 1 / (1 + A.thickness) ** 2).toFixed(4)};
            float alt = 1.0 - clamp(g, 0.0, 1.0);
            float f = pow(1.0 - alt, 1.6) * lit * ${A.glow.toFixed(2)};
            gl_FragColor = vec4(mix(dust, high, smoothstep(0.05, 0.6, alt)), f);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    scene.add(haze);
    const veil = new THREE.Mesh(
      new THREE.SphereGeometry(1.003, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: airUniforms,
        vertexShader: airVertex,
        fragmentShader: `uniform vec3 dust; uniform vec3 high; uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vDir;
          void main() { ${lit} float f = pow(1.0 - max(0.0, dot(vN, vV)), 4.0) * lit * ${A.veil.toFixed(2)}; gl_FragColor = vec4(dust, f); }`,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(veil);

    const start = facing(focus);
    const spin = { yaw: start.yaw, tilt: start.tilt, vYaw: 0, vTilt: 0, distance: GLOBE.distance.start };
    let dirty = true;
    const place = () => {
      spin.tilt = Math.max(-GLOBE.maxTilt, Math.min(GLOBE.maxTilt, spin.tilt));
      globe.rotation.set(spin.tilt, spin.yaw, 0);
      camera.position.set(0, 0, spin.distance);
      camera.lookAt(0, 0, 0);
      dirty = true;
    };
    place();
    redraw.current = () => {
      dirty = true;
    };

    // Coasting: each frame, spin on and slow down.
    let last = performance.now();
    let dragging = false;
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging && (Math.abs(spin.vYaw) > GLOBE.rest || Math.abs(spin.vTilt) > GLOBE.rest)) {
        spin.yaw += spin.vYaw * dt;
        spin.tilt += spin.vTilt * dt;
        const k = Math.exp(-GLOBE.decay * dt);
        spin.vYaw *= k;
        spin.vTilt *= k;
        place();
      }
      if (dirty || tilesDirty) {
        dirty = false;
        tilesDirty = false;
        updateTiles();
        renderer.render(scene, camera);
        updateNames();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    // What's under the pointer: the map's latitude and longitude there, or null off the globe. The ground is
    // raised, so the ray meets a sphere at the height found where it last met, a few times over.
    const ray = new THREE.Raycaster();
    const R = GLOBE.relief;
    const liftAt = (d: THREE.Vector3) => {
      if (!heights) return 0;
      const u = (((Math.atan2(d.z, -d.x) / (Math.PI * 2)) % 1) + 1) % 1;
      const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI;
      const x = Math.min(heights.w - 1, Math.floor(u * heights.w));
      const y = Math.min(heights.h - 1, Math.floor(v * heights.h));
      const m = R.min + (heights.data[(y * heights.w + x) * 4]! / 255) * (R.max - R.min);
      return (m / R.radiusM) * R.exaggerate;
    };
    const local = new THREE.Ray();
    const inverse = new THREE.Matrix4();
    const hit = new THREE.Vector3();
    const latLonAt = (e: PointerEvent | MouseEvent): LatLon | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      globe.updateMatrixWorld();
      local.copy(ray.ray).applyMatrix4(inverse.copy(globe.matrixWorld).invert());
      let radius = 1;
      let found = false;
      for (let i = 0; i < 4; i++) {
        if (!local.intersectSphere(new THREE.Sphere(new THREE.Vector3(), radius), hit)) break;
        found = true;
        radius = 1 + liftAt(hit.clone().normalize());
      }
      if (!found) return null;
      const d = hit.normalize();
      const lon = (((Math.atan2(d.z, -d.x) * 180) / Math.PI) % 360 + 360) % 360;
      return { lat: (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI, lon };
    };

    const canvas = renderer.domElement;
    let down: { x: number; y: number; moved: boolean; t: number } | null = null;
    // Where the spin was over the last moments of a drag, for the speed of the fling.
    let trail: { t: number; yaw: number; tilt: number }[] = [];
    // Two fingers pinch to zoom; the spin stops while they're down.
    const touches = new Touches();
    const onDown = (e: PointerEvent) => {
      touches.down(e);
      canvas.setPointerCapture(e.pointerId);
      if (touches.gesturing) {
        down = null;
        dragging = false;
        return;
      }
      down = { x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
      dragging = true;
      spin.vYaw = 0;
      spin.vTilt = 0;
      trail = [{ t: down.t, yaw: spin.yaw, tilt: spin.tilt }];
    };
    const onMove = (e: PointerEvent) => {
      const g = touches.move(e);
      if (touches.gesturing) {
        if (g) {
          spin.distance = Math.max(GLOBE.distance.min, Math.min(GLOBE.distance.max, spin.distance / g.scale));
          place();
        }
        return;
      }
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > GLOBE.clickSlop) down.moved = true;
        const k = GLOBE.drag * (spin.distance / GLOBE.distance.start);
        const now = performance.now();
        // Follow the pointer, and remember where, for the coast.
        spin.yaw += dx * k;
        spin.tilt += dy * k;
        trail.push({ t: now, yaw: spin.yaw, tilt: spin.tilt });
        trail = trail.filter((p) => now - p.t <= GLOBE.window);
        down.x = e.clientX;
        down.y = e.clientY;
        down.t = now;
        place();
        return;
      }
      callbacks.current.onHover(latLonAt(e));
    };
    const onUp = (e: PointerEvent) => {
      touches.up(e);
      if (!down) return;
      dragging = false;
      // The fling: how far it turned over the drag's last moments (none after a pause), capped.
      const now = performance.now();
      const recent = trail.filter((p) => now - p.t <= GLOBE.window);
      const first = recent[0];
      const lastP = recent.at(-1);
      const span = first && lastP ? Math.max(GLOBE.window / 2, lastP.t - first.t) / 1000 : 0;
      const cap = (v: number) => Math.max(-GLOBE.maxSpeed, Math.min(GLOBE.maxSpeed, v));
      spin.vYaw = span && first && lastP ? cap((lastP.yaw - first.yaw) / span) : 0;
      spin.vTilt = span && first && lastP ? cap((lastP.tilt - first.tilt) / span) : 0;
      if (!down.moved) {
        spin.vYaw = 0;
        spin.vTilt = 0;
        const at = latLonAt(e);
        if (at) callbacks.current.onPick(at);
      }
      down = null;
    };
    const onLeave = () => callbacks.current.onHover(null);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Sideways scrolling spins the planet; up and down (or a pinch) zooms.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        spin.vYaw = 0;
        spin.vTilt = 0;
        spin.yaw -= e.deltaX * GLOBE.scrollSpin * (spin.distance / GLOBE.distance.start);
        place();
        return;
      }
      spin.distance = Math.max(GLOBE.distance.min, Math.min(GLOBE.distance.max, spin.distance * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      place();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const resize = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      globe.geometry.dispose();
      (globe.material as THREE.Material).dispose();
      overlay.geometry.dispose();
      (overlay.material as THREE.Material).dispose();
      planet.dispose();
      reliefU.height.value?.dispose();
      for (const m of tileMat.values()) {
        m.map?.dispose();
        m.dispose();
      }
      for (const g of tileGeo.values()) g.dispose();
      nameLayer.remove();
      haze.geometry.dispose();
      (haze.material as THREE.Material).dispose();
      veil.geometry.dispose();
      (veil.material as THREE.Material).dispose();
      texture.dispose();
      textureRef.current = null;
      renderer.dispose();
      canvas.remove();
    };
    // The globe is made once; the map and where to face are read when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The map was redrawn: send it to the texture.
  useEffect(() => {
    if (textureRef.current) textureRef.current.needsUpdate = true;
    redraw.current();
  }, [version]);

  return <div ref={host} className="globe" />;
}
