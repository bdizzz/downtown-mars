import { describe, expect, it } from "vitest";
import { place } from "../src/ui/anchor";

// Where the guided tutorial's card goes next to what its step points at (F-007).

const view = { width: 1280, height: 800 };
const card = { width: 300, height: 180 };

describe("the guided card's anchor", () => {
  it("hangs below a target in the top half, the arrow under its middle", () => {
    const a = place({ left: 200, top: 4, width: 120, height: 28 }, card, view);
    expect(a.side).toBe("below");
    expect(a.top).toBe(4 + 28 + 12);
    expect(a.left + a.arrow).toBe(260);
  });

  it("sits above a target in the bottom half", () => {
    const a = place({ left: 600, top: 740, width: 80, height: 40 }, card, view);
    expect(a.side).toBe("above");
    expect(a.top + card.height).toBe(740 - 12);
  });

  it("stays on screen at the edges, the arrow still reaching the target", () => {
    const right = place({ left: 1200, top: 740, width: 70, height: 50 }, card, view);
    expect(right.left + card.width).toBeLessThanOrEqual(view.width - 8);
    expect(right.arrow).toBeLessThanOrEqual(card.width - 16);
    const left = place({ left: 0, top: 700, width: 40, height: 40 }, card, view);
    expect(left.left).toBe(8);
    expect(left.arrow).toBe(16);
  });

  it("goes beside a strip down the side, toward the middle, the arrow level with the target", () => {
    const f1 = { left: 1240, top: 380, width: 32, height: 24 };
    const a = place(f1, card, view, null, true);
    expect(a.side).toBe("left");
    expect(a.left + card.width).toBe(1240 - 12);
    expect(a.top + a.arrow).toBe(392);
    expect(place({ ...f1, left: 8 }, card, view, null, true).side).toBe("right");
  });

  it("clears what it's told to avoid, pointing at the target all the same", () => {
    const target = { left: 20, top: 650, width: 90, height: 27 };
    const details = { left: 16, top: 420, width: 320, height: 220 };
    const a = place(target, card, view, details);
    expect(a.top + card.height).toBe(420 - 12);
    expect(a.left + a.arrow).toBe(65);
  });
});
