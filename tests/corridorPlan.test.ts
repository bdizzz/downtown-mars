import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { edgeById, edgeVertices } from "../src/sim/edges";
import type { Location } from "../src/sim/placement";
import { createInitialState, type SimState } from "../src/sim/state";
import { EMPTY_CHAIN, extendChain, type Chain, type ChainPoint } from "../src/view/corridorPlan";

const ring = (floor: number, r: number, slot: number, w = 1, d = 1): Location => ({ kind: "ring", floor, ring: r, slot, w, d });

/** Ring 1 and ring 2 of floor 1 full of rooms, so every border there is eligible. */
function town(): SimState {
  const s = createInitialState(config);
  Object.assign(s.resources, { rock: 999, brick: 999, metal: 999 });
  const battery = s.layout.rooms.find((r) => r.type === "battery_bank")!;
  applyCommand(s, { type: "demolish", roomId: battery.id });
  for (let slot = 0; slot < s.layout.hole.ringSlots[0]!; slot++) {
    applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 1, slot) });
    applyCommand(s, { type: "build", room: "water_tank", at: ring(1, 2, slot) });
  }
  return s;
}

const e = (s: SimState, id: string) => edgeById(s.layout.hole, id)!;
const walk = (s: SimState, ids: string[], erase = false): Chain => ids.reduce((c, id) => extendChain(s.layout, c, e(s, id), erase), EMPTY_CHAIN);

/** Consecutive edges share a vertex, and no vertex is used twice along the way (no branches, no loops). */
function continuous(s: SimState, chain: Chain): boolean {
  const h = s.layout.hole;
  for (let i = 1; i < chain.edges.length; i++) {
    const a = edgeVertices(h, e(s, chain.edges[i - 1]!));
    const b = edgeVertices(h, e(s, chain.edges[i]!));
    if (!a.some((v) => b.includes(v))) return false;
  }
  return true;
}

describe("snaking a corridor", () => {
  it("grows along the borders the pointer crosses, as one continuous chain", () => {
    const s = town();
    // Out along the spoke at slot 3, then along the ring-1/ring-2 circle.
    const c = walk(s, ["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    expect(c.edges).toEqual(["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    expect(continuous(s, c)).toBe(true);
  });

  it("retracing trims it back, and it can then set off another way", () => {
    const s = town();
    let c = walk(s, ["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    c = extendChain(s.layout, c, e(s, "R1.1.3"), false); // back to the start
    expect(c.edges).toEqual(["R1.1.3"]);
    c = extendChain(s.layout, c, e(s, "A1.1.1/3"), false); // along the other circle instead
    expect(c.edges).toEqual(["R1.1.3", "A1.1.1/3"]);
    expect(continuous(s, c)).toBe(true);
  });

  it("fills in the gap when the pointer skips ahead", () => {
    const s = town();
    const c = walk(s, ["R1.1.3", "A1.1.4/9"]); // skipped the arc piece at 3/9
    expect(c.edges).toEqual(["R1.1.3", "A1.1.1/3", "A1.1.4/9"]);
    expect(continuous(s, c)).toBe(true);
  });

  it("never branches: a border off the side of the chain is ignored", () => {
    const s = town();
    const c = walk(s, ["R1.1.3", "R1.2.3", "A1.2.1/3", "A1.1.1/3"]);
    // A1.1.1/3 starts at the chain's middle vertex, not its end: it would branch, so the chain stays put.
    expect(c.edges).toEqual(["R1.1.3", "R1.2.3", "A1.2.1/3"]);
  });

  it("crosses rock, but not locked rings; erasing only follows existing corridors", () => {
    const s = createInitialState(config);
    expect(walk(s, ["R1.3.5"]).edges).toEqual(["R1.3.5"]); // rock both sides: fine
    expect(walk(s, ["R1.4.5"]).edges).toEqual([]); // a locked ring
    const t = town();
    applyCommand(t, { type: "drawCorridors", edges: ["R1.1.3", "R1.2.3"], finish: "rock" });
    expect(walk(t, ["R1.1.3", "R1.2.3", "A1.2.1/3"], true).edges).toEqual(["R1.1.3", "R1.2.3"]);
  });
});

describe("snaking steadily (T-104)", () => {
  /** A point a fraction u along an edge, from its first vertex (or its second, with from = 1). */
  const along = (s: SimState, id: string, u: number, from = 0): ChainPoint => {
    const ed = e(s, id);
    const f = from === 0 ? u : 1 - u;
    return ed.kind === "radial" ? { rings: ed.ring - 1 + f, turn: ed.turn } : { rings: ed.circle, turn: ed.a0 + f * (ed.a1 - ed.a0) };
  };

  it("a wobble back over a turn trims to the turn, but never sets off a third way from there", () => {
    const s = town();
    // Out along the spoke at slot 3, then a turn onto the ring-2/ring-3 circle.
    let c = walk(s, ["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    c = extendChain(s.layout, c, e(s, "R1.2.3"), false); // the wobble: back over the turn
    expect(c.edges).toEqual(["R1.1.3", "R1.2.3"]);
    // Neither straight on outward, nor the other way round the circle.
    expect(extendChain(s.layout, c, e(s, "R1.3.6"), false).edges).toEqual(["R1.1.3", "R1.2.3"]);
    expect(extendChain(s.layout, c, e(s, "A1.2.5/18"), false).edges).toEqual(["R1.1.3", "R1.2.3"]);
    // The way it went before: fine.
    c = extendChain(s.layout, c, e(s, "A1.2.1/3"), false);
    expect(c.edges).toEqual(["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    expect(continuous(s, c)).toBe(true);
  });

  it("retracing further back than the turn frees it again", () => {
    const s = town();
    let c = walk(s, ["R1.1.3", "R1.2.3", "A1.2.1/3"]);
    c = extendChain(s.layout, c, e(s, "R1.2.3"), false);
    c = extendChain(s.layout, c, e(s, "R1.1.3"), false); // further back, past the turn
    c = extendChain(s.layout, c, e(s, "A1.1.1/3"), false);
    expect(c.edges).toEqual(["R1.1.3", "A1.1.1/3"]);
  });

  it("a border joins only once the pointer is a quarter of the way along it, from the chain's end", () => {
    const s = town();
    expect(config.corridorTool.commitAlong).toBe(0.25);
    const c = walk(s, ["R1.1.3"]);
    // Along the ring-1/ring-2 circle from slot 3's spoke: the arc starts there.
    expect(extendChain(s.layout, c, e(s, "A1.1.1/3"), false, along(s, "A1.1.1/3", 0.1)).edges).toEqual(["R1.1.3"]);
    expect(extendChain(s.layout, c, e(s, "A1.1.1/3"), false, along(s, "A1.1.1/3", 0.3)).edges).toEqual(["R1.1.3", "A1.1.1/3"]);
    // The other way round, the arc ends there: measured from that end.
    expect(extendChain(s.layout, c, e(s, "A1.1.2/9"), false, along(s, "A1.1.2/9", 0.1, 1)).edges).toEqual(["R1.1.3"]);
    expect(extendChain(s.layout, c, e(s, "A1.1.2/9"), false, along(s, "A1.1.2/9", 0.3, 1)).edges).toEqual(["R1.1.3", "A1.1.2/9"]);
  });

  it("jitter through a crossing commits nothing", () => {
    const s = town();
    const start = walk(s, ["R1.1.3"]);
    let c = start;
    // Wobbling round the crossing of slot 3's spoke and the ring-1/ring-2 circle: just past it each way.
    for (let i = 0; i < 4; i++) {
      c = extendChain(s.layout, c, e(s, "R1.2.3"), false, along(s, "R1.2.3", 0.08));
      c = extendChain(s.layout, c, e(s, "A1.1.1/3"), false, along(s, "A1.1.1/3", 0.05));
      c = extendChain(s.layout, c, e(s, "A1.1.2/9"), false, along(s, "A1.1.2/9", 0.1, 1));
    }
    expect(c).toBe(start);
    // Then off along the spoke for real.
    c = extendChain(s.layout, c, e(s, "R1.2.3"), false, along(s, "R1.2.3", 0.4));
    expect(c.edges).toEqual(["R1.1.3", "R1.2.3"]);
  });
});
