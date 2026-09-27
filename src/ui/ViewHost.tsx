import { useEffect, useRef } from "react";
import { createStage } from "../render2d/stage";
import type { HoverInfo, Quality, Stage, StageOptions, Tool } from "../view/types";
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
  colorBlind: boolean;
  /** Which camera: the unrolled 2D view or the 3D cylinder. */
  mode: "2d" | "3d";
  quality: Quality;
  /** The chosen view couldn't start (e.g. no WebGL for 3D). */
  onViewError: (message: string) => void;
}

const CREATE: Record<Props["mode"], (host: HTMLElement, opts: StageOptions) => Promise<Stage>> = {
  "2d": createStage,
  // Loaded on first use, so players who stay in 2D never download Three.js.
  "3d": async (host, opts) => (await import("../render3d/stage3d")).createStage3D(host, opts),
};

/** Hosts whichever view is chosen, and hands it the same state and callbacks either way. */
export function ViewHost({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, mode, quality, onViewError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  // Latest props, read by the stage's callbacks without recreating it.
  const props = useRef({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, quality, onViewError });
  props.current = { snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, quality, onViewError };

  useEffect(() => {
    let cancelled = false;
    CREATE[mode](hostRef.current!, {
      onHover: (i) => props.current.onHover(i),
      onCommand: (c, quiet) => props.current.onCommand(c, quiet),
      onCancel: () => props.current.onCancel(),
      onSelect: (id) => props.current.onSelect(id),
      onInvalid: (reason) => props.current.onInvalid(reason),
      onError: (message) => props.current.onViewError(message),
    }).then((stage) => {
      // StrictMode mounts twice; the first stage may resolve after cleanup.
      if (cancelled) return stage.destroy();
      stageRef.current = stage;
      stage.setTool(props.current.tool);
      stage.setSelected(props.current.selected);
      stage.setOverlay(props.current.overlay);
      stage.setColorBlind(props.current.colorBlind);
      stage.setQuality(props.current.quality);
      if (props.current.snapshot) stage.update(props.current.snapshot);
    }, (err: unknown) => {
      if (!cancelled) props.current.onViewError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
      stageRef.current?.destroy();
      stageRef.current = null;
    };
  }, [mode]);

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

  useEffect(() => {
    stageRef.current?.setColorBlind(colorBlind);
  }, [colorBlind]);

  useEffect(() => {
    stageRef.current?.setQuality(quality);
  }, [quality]);

  return <div ref={hostRef} className="pixi-host" />;
}
