import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Layout, RoomInstance } from "../sim/placement";
import { disposeFurniture, furnitureMeshes, setFurnitureGlow } from "../render3d/furniture3d";
import { roomGeometry } from "../render3d/rooms3d";
import type { Fitted } from "../view/furnish";
import { orbitCamera } from "./scene";

// The template editor's 3D preview: the sample room's shell (walls and floor,
// as the game draws them) and its fitted furniture. One renderer lives as
// long as the preview; the room and furniture are swapped as they change.

export function Preview3D({ layout, room, fitted, accent }: { layout: Layout; room: RoomInstance; fitted: Fitted[]; accent: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<{ scene: THREE.Scene; render: () => void; shell: THREE.Object3D | null; items: THREE.Object3D | null; stop: () => void; key: string } | null>(null);

  // The renderer, lights and camera, once.
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f0d);
    scene.add(new THREE.HemisphereLight(0xffe6cc, 0x2a1510, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.2);
    sun.position.set(20, 40, 10);
    scene.add(sun);
    setFurnitureGlow(0.3);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const render = () => renderer.render(scene, camera);
    const state = { scene, render, shell: null as THREE.Object3D | null, items: null as THREE.Object3D | null, stop: () => {}, key: "", camera };
    view.current = state;
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(el);
    (state as unknown as { orbit: (target: THREE.Vector3, dist: number, theta: number) => void }).orbit = (target, dist, theta) => {
      state.stop();
      state.stop = orbitCamera(renderer.domElement, camera, dist, render, target, theta);
    };
    return () => {
      state.stop();
      resize.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      view.current = null;
    };
  }, []);

  // The room's shell, and the camera aimed at it, when the room changes.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (v.shell) {
      v.scene.remove(v.shell);
      (v.shell as THREE.Mesh).geometry.dispose();
    }
    const shell = new THREE.Mesh(roomGeometry(layout, room.cells.filter((c) => c.floor === Math.max(...room.cells.map((x) => x.floor)))), new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.35), side: THREE.DoubleSide, roughness: 0.9 }));
    v.shell = shell;
    v.scene.add(shell);
    const box = new THREE.Box3().setFromObject(shell);
    const centre = box.getCenter(new THREE.Vector3());
    const key = `${room.type}:${room.cells.map((c) => `${c.ring}.${c.slot}`).join(",")}`;
    if (key !== v.key) {
      v.key = key;
      // From the shaft side, looking out at the back wall (where most things stand).
      const facing = Math.atan2(centre.z, centre.x) + Math.PI;
      (v as unknown as { orbit: (t: THREE.Vector3, d: number, th: number) => void }).orbit(centre.setY(box.min.y), box.getSize(new THREE.Vector3()).length() * 0.8, facing);
    }
    v.render();
  }, [layout, room, accent]);

  // The furniture, whenever the fit changes.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (v.items) {
      v.scene.remove(v.items);
      disposeFurniture(v.items);
    }
    v.items = furnitureMeshes(fitted, accent);
    v.scene.add(v.items);
    v.render();
  }, [fitted, accent]);

  return <div ref={host} className="dev-canvas dev-preview" />;
}
