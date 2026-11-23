import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { ensureFloors, type Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { furnish } from "../src/view/furnish";
import { itemDef } from "../src/view/furniture";
import { LIFT_FILL, liftFill } from "../src/view/liftFill";
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

describe("a lift's shaft is walled thick (#565)", () => {
  it("has a solid collar round the car, open in front of its doors, in what it was built into; the rest is lobby", () => {
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
    // In the shaft's own frame: X across its doors, Z out of them.
    const shaft = furnish(s.layout, lift).find((f) => f.floor === 1 && f.item.startsWith("elevator_"))!;
    const [w, d] = itemDef(shaft.item).size;
    const at = (u: number, v: number): [number, number] => [
      shaft.x + u * Math.cos(shaft.turn) + v * Math.sin(shaft.turn),
      shaft.z - u * Math.sin(shaft.turn) + v * Math.cos(shaft.turn),
    ];
    const beside = at(w / 2 + LIFT_FILL.margin + LIFT_FILL.thick / 2, 0);
    const front = at(0, d / 2 + LIFT_FILL.margin + LIFT_FILL.thick / 2);
    const lobby = at(0, d / 2 + LIFT_FILL.margin + LIFT_FILL.thick + 1);
    expect(f1.open(...beside)).toBe(false);
    expect(regionAt(s.layout, 1, ...beside)).toBeNull();
    expect(f1.open(...front)).toBe(true);
    expect(f1.open(...lobby)).toBe(true);
    expect(regionAt(s.layout, 1, ...lobby)).toBe(`room:${lift.id}`);
  });
});
