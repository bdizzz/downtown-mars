import { describe, expect, it } from "vitest";
import { cameraDragFor, cameraDragHint } from "../src/view/cameraDrag";
import type { Tool } from "../src/view/types";

const keys = (k: string) => ({ metaKey: k.includes("meta"), ctrlKey: k.includes("ctrl"), shiftKey: k.includes("shift") });
const room: Tool = { kind: "build", room: "home", shape: [1, 1] };
const corridor: Tool = { kind: "corridor", finish: "bare", erase: false };
const windows: Tool = { kind: "corridor", finish: "bare", erase: false, windows: true };

describe("camera drags with a key held (#585)", () => {
  it("leaves the plain drag alone", () => {
    for (const t of [null, room, corridor]) expect(cameraDragFor(keys(""), t)).toBeNull();
  });

  it("turns with ⌘ or Ctrl, in Build or out", () => {
    for (const t of [null, room, corridor, windows]) {
      expect(cameraDragFor(keys("meta"), t)).toBe("turn");
      expect(cameraDragFor(keys("ctrl"), t)).toBe("turn");
    }
  });

  it("pans with Shift, except with the corridor tool, whose Shift fills in", () => {
    expect(cameraDragFor(keys("shift"), null)).toBe("pan");
    expect(cameraDragFor(keys("shift"), room)).toBe("pan");
    expect(cameraDragFor(keys("shift"), windows)).toBe("pan");
    expect(cameraDragFor(keys("shift"), corridor)).toBeNull();
    expect(cameraDragFor(keys("meta shift"), corridor)).toBe("pan");
    expect(cameraDragFor(keys("ctrl shift"), room)).toBe("pan");
  });

  it("names the keys for the platform", () => {
    expect(cameraDragHint(room, true)).toBe("⌘ drag turns the view · ⇧ drag pans");
    expect(cameraDragHint(corridor, false)).toBe("Ctrl drag turns the view · Ctrl ⇧ drag pans");
  });
});
