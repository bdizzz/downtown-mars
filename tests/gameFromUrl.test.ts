import { describe, expect, it } from "vitest";
import { gameFromUrl } from "../src/ui/devGames";

describe("gameFromUrl (#518)", () => {
  it("names a dev game's file", () => {
    expect(gameFromUrl("?game=mid", true)).toBe("/dev-save-mid.json");
    expect(gameFromUrl("?game=Late", true)).toBe("/dev-save-late.json");
  });
  it("takes a save's path on this server", () => {
    expect(gameFromUrl("?game=saves/big.json", true)).toBe("/saves/big.json");
    expect(gameFromUrl("?game=/dev-save-early.json", true)).toBe("/dev-save-early.json");
  });
  it("refuses other hosts, climbing out and anything else", () => {
    for (const q of ["?game=https://x.com/a.json", "?game=//x.com/a.json", "?game=../a.json", "?game=a/../../b.json", "?game=nope", "?other=1", "?game="])
      expect(gameFromUrl(q, true)).toBeNull();
  });
  it("does nothing where dev games aren't offered", () => {
    expect(gameFromUrl("?game=mid", false)).toBeNull();
  });
});
