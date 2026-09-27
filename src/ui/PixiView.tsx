import { useEffect, useRef } from "react";
import { createStage, type HoverInfo, type Stage, type Tool } from "../render2d/stage";
import type { SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";

interface Props {
  snapshot: Snapshot | null;
  tool: Tool;
  onHover: (info: HoverInfo | null) => void;
  onCommand: (cmd: SimCommand, quiet?: boolean) => void;
  onCancel: () => void;
  selected: number | null;
  onSelect: (roomId: number | null) => void;
  onInvalid: (reason: string) => void;
  overlay: string | null;
}

export function PixiView({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  // Latest props, read by the stage's callbacks without recreating it.
  const props = useRef({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay });
  props.current = { snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay };

  useEffect(() => {
    let cancelled = false;
    createStage(hostRef.current!, {
      onHover: (i) => props.current.onHover(i),
      onCommand: (c, quiet) => props.current.onCommand(c, quiet),
      onCancel: () => props.current.onCancel(),
      onSelect: (id) => props.current.onSelect(id),
      onInvalid: (reason) => props.current.onInvalid(reason),
    }).then((stage) => {
      // StrictMode mounts twice; the first stage may resolve after cleanup.
      if (cancelled) return stage.destroy();
      stageRef.current = stage;
      stage.setTool(props.current.tool);
      stage.setSelected(props.current.selected);
      stage.setOverlay(props.current.overlay);
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

  useEffect(() => {
    stageRef.current?.setSelected(selected);
  }, [selected]);

  useEffect(() => {
    stageRef.current?.setOverlay(overlay);
  }, [overlay]);

  return <div ref={hostRef} className="pixi-host" />;
}
