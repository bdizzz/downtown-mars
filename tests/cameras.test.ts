import { afterEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src/ui/settings";
import { CAMERAS } from "../src/view/cameras";

describe("the 3D cameras", () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  const stored = (view3d: unknown) => {
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify({ view3d }), setItem: () => {} };
  };

  it("are Free view, Cutaway and First person", () => {
    expect(CAMERAS.map((c) => c.name)).toEqual(["Free view", "Cutaway", "First person"]);
  });

  it("fall back to Free view from the removed Shaft and Top cameras, and drop X-ray", () => {
    for (const camera of ["shaft", "top"]) {
      stored({ camera, xray: true, wallsDown: true });
      const v = loadSettings().view3d;
      expect(v.camera).toBe("iso");
      expect(v.wallsDown).toBe(true);
      expect("xray" in v).toBe(false);
    }
  });

  it("keep a camera that's still there", () => {
    stored({ camera: "cutaway" });
    expect(loadSettings().view3d.camera).toBe("cutaway");
  });
});
