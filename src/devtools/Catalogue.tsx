import { useEffect, useRef } from "react";
import * as THREE from "three";
import { itemMesh, setFurnitureGlow } from "../render3d/furniture3d";
import { furniture, itemDef } from "../view/furniture";
import { accentFor, orbitCamera } from "./scene";

// The catalogue: a room type's items side by side on a floor, to look at
// the models. Drag to turn, scroll to zoom.

export function Catalogue({ room }: { room: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const ids = room ? (furniture.rooms[room] ?? []) : Object.keys(furniture.items);
    const accent = room ? accentFor(room) : "#9a8574";
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f0d);
    scene.add(new THREE.HemisphereLight(0xffe6cc, 0x2a1510, 1.4));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.4);
    sun.position.set(6, 12, 8);
    scene.add(sun);

    // A row (or grid) of items with a metre between them, each on a floor tile.
    const perRow = Math.max(1, Math.ceil(Math.sqrt(ids.length * 2)));
    let x = 0;
    let z = 0;
    let rowDepth = 0;
    let width = 0;
    const items = new THREE.Group();
    ids.forEach((id, i) => {
      const [w, d] = itemDef(id).size;
      if (i && i % perRow === 0) {
        width = Math.max(width, x);
        x = 0;
        z += rowDepth + 1.5;
        rowDepth = 0;
      }
      const g = itemMesh(id, accent);
      g.position.set(x + w / 2, 0, z + d / 2);
      items.add(g);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, d + 0.4), new THREE.MeshStandardMaterial({ color: 0x4a3a30 }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x + w / 2, 0.001, z + d / 2);
      items.add(tile);
      x += w + 1;
      rowDepth = Math.max(rowDepth, d);
    });
    width = Math.max(width, x);
    items.position.set(-width / 2, 0, -(z + rowDepth) / 2);
    scene.add(items);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x2a1a14 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    setFurnitureGlow(0.3);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    const stop = orbitCamera(renderer.domElement, camera, Math.max(8, width * 0.9), () => renderer.render(scene, camera));
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    resize.observe(el);
    return () => {
      stop();
      resize.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [room]);
  return <div ref={host} className="dev-canvas" />;
}
