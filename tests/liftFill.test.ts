import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { liftFill } from "../src/view/liftFill";
import { regionAt } from "../src/view/walk";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

function deep(): SimState {
  const s = createInitialState(config);
  s.drill.active = false;
  s.layout.hole.floors = 3;
  ensureFloors(s.layout);
  Object.assign(s.resources, { rock: 400, brick: 200, metal: 200, machinery: 50, electronics: 50 });
  return s;
}

describe("a lift's solid core (#565)", () => {
  it("fills round the shaft but for a landing and the way in from its door, in what it was built into", () => {
    const s = deep();
    const r = applyCommand(s, { type: "build", room: "elevator", at: ring(1, 1, 5) });
    if (!r.ok) throw new Error(r.reason);
    applyCommand(s, { type: "consoleFinish" });
    const lift = s.layout.rooms.find((x) => x.id === r.roomId)!;
    const f1 = liftFill(s.layout, lift, 1)!;
    const f2 = liftFill(s.layout, lift, 2)!;
    expect(f1.look).toBe("marscrete"); // floor 1's ring came dug out
    expect(f2.look).toBe("rock");
    expect(f1.runs.length).toBeGreaterThan(0);
    // The back corners are solid; the middle of the front (the door onto the tube) is open.
    const { frame } = f1;
    const corner = frame.rOut - 0.3;
    const a = frame.left(corner) + 0.02;
    expect(f1.open(corner * Math.cos(a), corner * Math.sin(a))).toBe(false);
    expect(regionAt(s.layout, 1, corner * Math.cos(a), corner * Math.sin(a))).toBeNull();
    const rd = frame.rIn + 1.5;
    const mid = (frame.left(rd) + frame.right(rd)) / 2;
    expect(f1.open(rd * Math.cos(mid), rd * Math.sin(mid))).toBe(true);
    expect(regionAt(s.layout, 1, rd * Math.cos(mid), rd * Math.sin(mid))).toBe(`room:${lift.id}`);
  });
});
