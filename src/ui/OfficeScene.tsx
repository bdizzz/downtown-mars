import { useEffect, useMemo, useRef, useState } from "react";
import type { Layout } from "../sim/placement";
import type { OfficeScene as Scene } from "../render3d/office3d";
import { officeLook } from "../view/officeScene";

/**
 * The office as a room you're standing in: a still 3D scene laid over the hole while the office
 * panel is open (view/officeScene.ts says what's in it). Three.js loads on first use, as for the 3D
 * view; without WebGL nothing is drawn and the hole stays in view.
 */
export function OfficeScene({ layout }: { layout: Layout }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const look = useMemo(() => officeLook(layout), [layout]);
  const latest = useRef(look);
  latest.current = look;

  useEffect(() => {
    let cancelled = false;
    import("../render3d/office3d").then(
      ({ createOfficeScene }) => {
        if (cancelled || !host.current) return;
        try {
          scene.current = createOfficeScene(host.current);
          scene.current.set(latest.current);
          setReady(true);
        } catch {
          setFailed(true);
        }
      },
      () => setFailed(true),
    );
    return () => {
      cancelled = true;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.set(look);
  }, [look]);

  if (failed) return null;
  return <div ref={host} className={`office-scene${ready ? " ready" : ""}`} role="img" aria-label="Your office" />;
}
