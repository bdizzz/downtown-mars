import { useEffect, useRef } from "react";
import { createStage, type HoverInfo, type Stage, type Tool } from "../render2d/stage";
import type { SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";

interface Props {
  snapshot: Snapshot | null;
  tool: Tool;
  onHover: (info: HoverInfo | null) => void;
  onCommand: (cmd: SimCommand) => void;
  onCancel: () => void;
}

export function PixiView({ snapshot, tool, onHover, onCommand, onCancel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  // Latest props, read by the stage's callbacks without recreating it.
  const props = useRef({ snapshot, tool, onHover, onCommand, onCancel });
  props.current = { snapshot, tool, onHover, onCommand, onCancel };

  useEffect(() => {
    let cancelled = false;
    createStage(hostRef.current!, {
      onHover: (i) => props.current.onHover(i),
      onCommand: (c) => props.current.onCommand(c),
      onCancel: () => props.current.onCancel(),
    }).then((stage) => {
      // StrictMode mounts twice; the first stage may resolve after cleanup.
      if (cancelled) return stage.destroy();
      stageRef.current = stage;
      stage.setTool(props.current.tool);
      if (props.current.snapshot) stage.update(props.current.snapshot);
    });
    return () => {
      cancelled = true;
      stageRef.current?.destroy();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (snapshot) stageRef.current?.update(snapshot);
  }, [snapshot]);

  useEffect(() => {
    stageRef.current?.setTool(tool);
  }, [tool]);

  return <div ref={hostRef} className="pixi-host" />;
}
