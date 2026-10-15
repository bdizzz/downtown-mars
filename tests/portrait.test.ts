import { describe, expect, it } from "vitest";
import raw from "../data/portraits.json";
import { addNotable } from "../src/sim/notables";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { portraitFace, portraitSvg } from "../src/view/portrait";

describe("notable headshots (T-054)", () => {
  const state = createInitialState(config);
  while (addNotable(state));
  const notables = state.notables;

  it("draws the same face for the same person every time", () => {
    for (const n of notables) {
      expect(portraitSvg({ ...n })).toBe(portraitSvg(n));
    }
  });

  it("gives every notable in a full hole a distinct face", () => {
    expect(notables.length).toBe(20);
    const faces = notables.map((n) => JSON.stringify({ ...portraitFace(n), mood: 0, prop: 0, eyeGap: 0 }));
    expect(new Set(faces).size).toBe(notables.length);
  });

  it("puts a hint of their work on some, from their own role's props", () => {
    const people = Array.from({ length: 300 }, (_, i) => ({ id: i, name: `P${i}`, role: Object.keys(raw.roles)[i % 7]!, traits: [] }));
    const faces = people.map((p) => portraitFace(p));
    const withProp = faces.filter((f) => f.prop).length / faces.length;
    expect(withProp).toBeGreaterThan(0.35);
    expect(withProp).toBeLessThan(0.65);
    people.forEach((p, i) => {
      const prop = faces[i]!.prop;
      if (prop) expect((raw.roles as Record<string, { props: string[] }>)[p.role]!.props).toContain(prop);
      if (prop) expect(portraitSvg(p).length).toBeGreaterThan(0);
    });
  });

  it("lets traits set the expression", () => {
    const base = { id: 3, name: "Ana Ruiz", role: "worker" };
    expect(portraitFace({ ...base, traits: ["Hothead", "Idealist"] }).mood).toBe("frown");
    expect(portraitFace({ ...base, traits: ["Pragmatist", "Charismatic"] }).mood).toBe("grin");
    // Only the mood changes: the rest of the face is the same person.
    const a = portraitFace({ ...base, traits: ["Hothead"] });
    const b = portraitFace({ ...base, traits: ["Charismatic"] });
    expect({ ...a, mood: "" }).toEqual({ ...b, mood: "" });
  });

  it("makes well-formed SVG with no NaN", () => {
    for (const n of notables) {
      const svg = portraitSvg(n);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });
});
