import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { isOpen } from "../src/sim/excavation";
import { highlightsSlot } from "../src/view/interaction";

describe("what lights up under the pointer", () => {
  it("bare rock only in Build mode; dug-out space always", () => {
    const s = createInitialState(config);
    const h = s.layout.hole;
    const rock = { kind: "slot" as const, floor: 1, ring: h.unlockedRings, slot: 0, locked: false, digging: false, angle: 0 };
    const dug = { kind: "slot" as const, floor: 1, ring: 1, slot: 4, locked: false, digging: false, angle: 0 };
    expect(isOpen(s.layout, rock)).toBe(false);
    expect(isOpen(s.layout, dug)).toBe(true);
    expect(highlightsSlot(s.layout, rock, false)).toBe(false);
    expect(highlightsSlot(s.layout, rock, true)).toBe(true);
    expect(highlightsSlot(s.layout, dug, false)).toBe(true);
  });
});
