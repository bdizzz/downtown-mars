import { useCallback, useEffect, useRef, useState } from "react";
import type { HoverInfo, Tool } from "../render2d/stage";
import type { SimCommand } from "../sim/commands";
import { roomDef } from "../sim/rooms";
import { BuildPalette, shapesFor } from "./BuildPalette";
import { Hud } from "./Hud";
import { PixiView } from "./PixiView";
import { StatusBar } from "./StatusBar";
import { useSim } from "./useSim";

const NOTICE_MS = 3000;

export function App() {
  const { snapshot, speed, setSpeed, send } = useSim();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number>(undefined);

  const onCommand = useCallback(
    async (cmd: SimCommand) => {
      const result = await send(cmd);
      if (!result.ok) {
        setNotice(result.reason);
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
      }
    },
    [send],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setTool(null);
      if (e.code === "KeyR") {
        setTool((t) => {
          if (t?.kind !== "build") return t;
          const shapes = shapesFor(roomDef(t.room));
          const i = shapes.findIndex(([w, d]) => w === t.shape[0] && d === t.shape[1]);
          return { ...t, shape: shapes[(i + 1) % shapes.length]! };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <Hud snapshot={snapshot} speed={speed} setSpeed={setSpeed} setDrill={(active) => onCommand({ type: "setDrill", active })} />
      <div className="main">
        <BuildPalette tool={tool} setTool={setTool} />
        <PixiView snapshot={snapshot} tool={tool} onHover={setHover} onCommand={onCommand} onCancel={() => setTool(null)} />
      </div>
      <StatusBar info={hover} hole={snapshot?.layout.hole} notice={notice} />
    </div>
  );
}
