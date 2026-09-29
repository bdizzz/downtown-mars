import { useEffect, useRef } from "react";
import { createStage } from "../render2d/stage";
import { createPlanStage } from "../render2d/plan";
import type { ViewMode } from "./settings";
import type { View3d } from "../view/cameras";
import type { HoverInfo, Graphics, PendingBuild, Proposal, Stage, StageOptions, Tool, Warning } from "../view/types";
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
  /** Which view: the unrolled wall, one floor from above, or the 3D cylinder. */
  mode: ViewMode;
  /** The floor the plan and 3D views focus on (null: every floor, in 3D). */
  floor: number | null;
  /** A snaked corridor chain waiting for confirmation, shown until answered. */
  proposal: Proposal | null;
  onPropose: (p: Proposal) => void;
  /** A warning to outline in red (corridors to be filled in, what they'd cut off). */
  warning: Warning | null;
  onConfirmBuild: (b: PendingBuild) => void;
  graphics: Graphics;
  view3d: View3d;
  /** Build mode is open. */
  building: boolean;
  /** The chosen view couldn't start (e.g. no WebGL for 3D). */
  onViewError: (message: string) => void;
  /** Walking in first person (3D), or not. */
  onWalking: (walking: boolean) => void;
}

const CREATE: Record<Props["mode"], (host: HTMLElement, opts: StageOptions) => Promise<Stage>> = {
  "2d": createStage,
  plan: createPlanStage,
  // Loaded on first use, so players who stay in 2D never download Three.js.
  "3d": async (host, opts) => (await import("../render3d/stage3d")).createStage3D(host, opts),
};

/** Hosts whichever view is chosen, and hands it the same state and callbacks either way. */
export function ViewHost({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, mode, floor, proposal, onPropose, warning, onConfirmBuild, graphics, view3d, building, onViewError, onWalking }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  // Latest props, read by the stage's callbacks without recreating it.
  const props = useRef({ snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, graphics, view3d, building, floor, proposal, onPropose, warning, onConfirmBuild, onViewError, onWalking });
  props.current = { snapshot, tool, onHover, onCommand, onCancel, selected, onSelect, onInvalid, overlay, colorBlind, graphics, view3d, building, floor, proposal, onPropose, warning, onConfirmBuild, onViewError, onWalking };

  useEffect(() => {
    let cancelled = false;
    CREATE[mode](hostRef.current!, {
      onHover: (i) => props.current.onHover(i),
      onCommand: (c, quiet) => props.current.onCommand(c, quiet),
      onCancel: () => props.current.onCancel(),
      onSelect: (id) => props.current.onSelect(id),
      onInvalid: (reason) => props.current.onInvalid(reason),
      onError: (message) => props.current.onViewError(message),
      onPropose: (p) => props.current.onPropose(p),
      onConfirmBuild: (b) => props.current.onConfirmBuild(b),
      onWalking: (w) => props.current.onWalking(w),
    }).then((stage) => {
      // StrictMode mounts twice; the first stage may resolve after cleanup.
      if (cancelled) return stage.destroy();
      stageRef.current = stage;
      stage.setTool(props.current.tool);
      stage.setSelected(props.current.selected);
      stage.setOverlay(props.current.overlay);
      stage.setColorBlind(props.current.colorBlind);
      stage.setGraphics(props.current.graphics);
      stage.setView3d(props.current.view3d);
      stage.setBuildMode(props.current.building);
      stage.setFloor(props.current.floor);
      stage.setProposal(props.current.proposal);
      stage.setWarning(props.current.warning);
      if (props.current.snapshot) stage.update(props.current.snapshot);
    }, (err: unknown) => {
      if (!cancelled) props.current.onViewError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
      props.current.onWalking(false);
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
    stageRef.current?.setGraphics(graphics);
  }, [graphics]);
  useEffect(() => {
    stageRef.current?.setView3d(view3d);
  }, [view3d]);
  useEffect(() => {
    stageRef.current?.setBuildMode(building);
  }, [building]);

  useEffect(() => {
    stageRef.current?.setFloor(floor);
  }, [floor]);

  useEffect(() => {
    stageRef.current?.setProposal(proposal);
  }, [proposal]);

  useEffect(() => {
    stageRef.current?.setWarning(warning);
  }, [warning]);

  return <div ref={hostRef} className="pixi-host" />;
}
