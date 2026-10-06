import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Touches } from "../view/touch";

// The planet as a globe: the map (an equirectangular canvas) wrapped on a
// sphere. Drag to spin it; let go and it coasts, slowing to a stop. Scroll
// to zoom. Pointing and clicking find the latitude and longitude under the
// pointer, as the flat map did.

export type LatLon = { lat: number; lon: number };

const GLOBE = {
  /** Camera distance, in globe radii: where it starts, and how close and far it goes. */
  distance: { start: 3.7, min: 1.6, max: 6 },
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
  atmosphere: 0xe07a3f,
};

interface Props {
  /** The map to wrap: 2:1, longitude 0 at the left edge, north at the top. */
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

export function Globe({ map, version, focus, onHover, onPick }: Props) {
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

    const texture = new THREE.CanvasTexture(map);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textureRef.current = texture;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    globe.rotation.order = "XYZ";
    scene.add(globe);
    // A thin glowing haze round the rim: brightest at the edge, facing away from you.
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(GLOBE.atmosphere) } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 color; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(color, f * 0.8); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    scene.add(haze);

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
      if (dirty) {
        dirty = false;
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    // What's under the pointer: the map's latitude and longitude there, or null off the globe.
    const ray = new THREE.Raycaster();
    const latLonAt = (e: PointerEvent | MouseEvent): LatLon | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(globe)[0];
      if (!hit?.uv) return null;
      return { lat: hit.uv.y * 180 - 90, lon: hit.uv.x * 360 };
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
      haze.geometry.dispose();
      (haze.material as THREE.Material).dispose();
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
