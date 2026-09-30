import { describe, expect, it } from "vitest";
import { nextSpeed, speedStep } from "../src/ui/Hud";

describe("speed keys", () => {
  it("read minus and plus, on the main keys or the keypad", () => {
    expect(speedStep({ code: "Minus", key: "-" })).toBe(-1);
    expect(speedStep({ code: "NumpadSubtract", key: "-" })).toBe(-1);
    expect(speedStep({ code: "Equal", key: "=" })).toBe(1);
    expect(speedStep({ code: "Equal", key: "+" })).toBe(1);
    expect(speedStep({ code: "NumpadAdd", key: "+" })).toBe(1);
    expect(speedStep({ code: "KeyA", key: "a" })).toBe(0);
  });

  it("step through 1×, 2× and 4×, and do nothing past either end", () => {
    expect(nextSpeed(1, 1)).toBe(2);
    expect(nextSpeed(2, 1)).toBe(4);
    expect(nextSpeed(4, 1)).toBeNull();
    expect(nextSpeed(4, -1)).toBe(2);
    expect(nextSpeed(1, -1)).toBeNull();
  });
});
