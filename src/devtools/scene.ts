import * as THREE from "three";
import { CATEGORY_COLORS, cssColor } from "../render2d/palette";
import { roomDef } from "../sim/rooms";

// Bits the dev tools' 3D views share.

/** A room type's category colour, as the accent its furniture takes. */
export function accentFor(room: string): string {
  return cssColor(CATEGORY_COLORS[roomDef(room).category] ?? 0x888888);
}

/**
 * Orbit a camera around a point on the floor: drag to turn and tilt, scroll
 * to zoom. Calls `render` after each move. Returns a function that stops it.
 */
export function orbitCamera(el: HTMLElement, camera: THREE.PerspectiveCamera, distance: number, render: () => void, target = new THREE.Vector3(), theta = Math.PI / 4): () => void {
  const view = { theta, phi: 0.9, dist: distance };
  const apply = () => {
    const r = view.dist;
    camera.position.set(target.x + r * Math.sin(view.phi) * Math.cos(view.theta), target.y + r * Math.cos(view.phi), target.z + r * Math.sin(view.phi) * Math.sin(view.theta));
    camera.lookAt(target);
    render();
  };
  let drag: { x: number; y: number } | null = null;
  const down = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    view.theta += (e.clientX - drag.x) * 0.008;
    view.phi = Math.min(1.5, Math.max(0.1, view.phi - (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY };
    apply();
  };
  const up = () => (drag = null);
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    view.dist = Math.min(300, Math.max(2, view.dist * Math.exp(e.deltaY * 0.002)));
    apply();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("wheel", wheel, { passive: false });
  apply();
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("wheel", wheel);
  };
}
