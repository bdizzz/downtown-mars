import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { furnitureMeshes, setFurnitureGlow } from "../render3d/furniture3d";
import { roomGeometry, setWallsDown, withWallsDown } from "../render3d/rooms3d";
import { roomDef } from "../sim/rooms";
import { fit, frameOf, layouts } from "../view/furnish";
import { orbitCamera, accentFor } from "./scene";
import { sampleRoom } from "./TemplateEditor";

// Every template at once: each fitted into a sample room in the chosen ring,
// turned so its front (shaft side) faces the camera, and laid out in a grid
// with its name. For reviewing the whole set side by side. Drag to turn,
// scroll to zoom.

const CELL = 48;
const COLUMNS = 7;

/** A text label as a sprite, for the grid. */
function label(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = "600 44px system-ui, sans-serif";
  c.width = Math.ceil(g.measureText(text).width) + 24;
  c.height = 60;
  g.font = "600 44px system-ui, sans-serif";
  g.fillStyle = "rgba(20,10,8,0.8)";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#f6efe6";
  g.textBaseline = "middle";
  g.fillText(text, 12, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((c.width / c.height) * 2.2, 2.2, 1);
  return s;
}

export function Overview() {
  const host = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState(1);
  // One template to look at closely, or all of them.
  const [focus, setFocus] = useState<string>("");
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f0d);
    scene.add(new THREE.HemisphereLight(0xffe6cc, 0x2a1510, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
    sun.position.set(30, 80, 40);
    scene.add(sun);
    setFurnitureGlow(0.3);

    const keys = Object.keys(layouts.templates).sort();
    keys.forEach((key, i) => {
      const [type, shape, role] = key.split(":") as [string, string, string | undefined];
      const [w, d] = shape.split("x").map(Number) as [number, number];
      const sample = sampleRoom(type, [w, d], Math.min(ring, 7 - d), { left: false, right: false });
      if (!sample) return;
      const { layout, room } = sample;
      // Stairs and elevators span floors 2–3: show the floor this template is for.
      const floor = roomDef(type).stacks ? (role === "top" ? 2 : 3) : undefined;
      const frame = frameOf(layout, room, floor);
      if (!frame) return;
      const onFloor = floor ?? Math.max(...room.cells.map((c) => c.floor));
      const accent = accentFor(type);
      const g = new THREE.Group();
      // Walls down, as in the game, so what's inside shows.
      g.add(new THREE.Mesh(roomGeometry(layout, room.cells.filter((c) => c.floor === onFloor)), withWallsDown(new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.45), side: THREE.DoubleSide, roughness: 0.9 }))));
      g.add(furnitureMeshes(fit(frame, layouts.templates[key]!), accent));
      // Turn the room so its middle faces the camera (front toward +z), and centre it in its grid cell.
      const rMid = (frame.rIn + frame.rOut) / 2;
      const a = (frame.left(rMid) + frame.right(rMid)) / 2;
      g.rotation.y = a + Math.PI / 2;
      const gx = (i % COLUMNS) * CELL;
      const gz = Math.floor(i / COLUMNS) * CELL;
      // Turned, the room's middle sits at (0, y, −rMid): lift it to the ground and bring it to the cell's centre.
      g.position.set(gx, -frame.y, gz + rMid);
      scene.add(g);
      if (!focus) {
        const tag = label(key);
        tag.position.set(gx, 6, gz + 12);
        scene.add(tag);
      }
    });
    const rows = Math.ceil(keys.length / COLUMNS);
    const at = keys.indexOf(focus);
    const target =
      at >= 0
        ? new THREE.Vector3((at % COLUMNS) * CELL, 0, Math.floor(at / COLUMNS) * CELL)
        : new THREE.Vector3(((COLUMNS - 1) * CELL) / 2, 0, ((rows - 1) * CELL) / 2);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
    const render = () => renderer.render(scene, camera);
    setWallsDown(true);
    const stop = orbitCamera(renderer.domElement, camera, at >= 0 ? 34 : CELL * rows * 1.1, render, target, Math.PI / 2, at >= 0 ? 0.6 : 0.9);
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(el);
    return () => {
      setWallsDown(false);
      stop();
      resize.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [ring, focus]);
  return (
    <div className="dev-views">
      <div className="dev-row dev-overview-bar">
        Ring{" "}
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <button key={r} className={r === ring ? "on" : ""} onClick={() => setRing(r)}>
            {r}
          </button>
        ))}
        <select value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="">All templates</option>
          {Object.keys(layouts.templates)
            .sort()
            .map((k) => (
              <option key={k}>{k}</option>
            ))}
        </select>
        <span className="k">Every template, fitted into a room in this ring (rooms too deep for it go as far out as they can).</span>
      </div>
      <div ref={host} className="dev-canvas" />
    </div>
  );
}
