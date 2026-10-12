import { afterEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src/ui/settings";
import * as THREE from "three";
import { CAMERAS, CUT_ANGLE } from "../src/view/cameras";
import { intersectGlobalClipping } from "../src/render3d/wedgeClip";

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

  it("keep the cutaway's angle, in range: a flat cut when it's missing or broken", () => {
    stored({ camera: "cutaway", cutAngle: 90 });
    expect(loadSettings().view3d.cutAngle).toBe(90);
    stored({ camera: "cutaway", cutAngle: 10 });
    expect(loadSettings().view3d.cutAngle).toBe(CUT_ANGLE.min);
    stored({ camera: "cutaway", cutAngle: 400 });
    expect(loadSettings().view3d.cutAngle).toBe(CUT_ANGLE.max);
    stored({ camera: "cutaway" });
    expect(loadSettings().view3d.cutAngle).toBe(180);
    stored({ camera: "cutaway", cutAngle: "wide" });
    expect(loadSettings().view3d.cutAngle).toBe(180);
  });
});

describe("the cutaway's wedge", () => {
  it("makes the renderer's clipping planes intersect: only what's past all of them goes", () => {
    expect(intersectGlobalClipping()).toBe(true);
    const chunk = THREE.ShaderChunk.clipping_planes_fragment;
    expect(chunk).toContain("if ( pastAll ) discard;");
    expect(chunk).not.toMatch(/plane\.w \) discard;/);
    // Again is harmless.
    expect(intersectGlobalClipping()).toBe(true);
    expect(THREE.ShaderChunk.clipping_planes_fragment).toBe(chunk);
  });
});
