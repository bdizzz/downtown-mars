import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { makeSnapshot, type Snapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { barItems, GROUPS, HUD_IDS, needs, topExtras } from "../src/view/hudItems";
import { ICONS, iconSvg, isIcon } from "../src/view/icons";

const fresh = () => makeSnapshot(createInitialState(config), config);
const cell = (s: Snapshot, id: string) => barItems(s).flat().find((i) => i.id === id)!;

describe("the top bar (T-089)", () => {
  it("every cell has a unique stable id and an icon from the set", () => {
    const items = barItems(fresh()).flat();
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) {
      expect(i.id).toBe(`res:${i.trend}`);
      expect(isIcon(i.icon), i.id).toBe(true);
    }
    expect(new Set(HUD_IDS).size).toBe(HUD_IDS.length);
  });

  it("every resource that can show has its own icon, not the stand-in", () => {
    for (const id of ["water", "meals", "rations", "rawFood", "soil", "rock", "brick", "metal", "machinery", "electronics", "ore", "silica", "glass", "fiber"]) expect(isIcon(id), id).toBe(true);
  });

  it("icons are whole SVGs in the colour asked for", () => {
    for (const id of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      const svg = iconSvg(id, "#ffffff");
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 16 16"[^>]*>.*<\/svg>$/);
      expect(svg).not.toContain("currentColor");
    }
  });

  it("a fresh game needs nothing of you, beyond what's coming", () => {
    const s = fresh();
    expect(needs(s).filter((n) => n.level === "bad")).toEqual([]);
  });

  it("a stock running out turns amber, then red, and comes first in the needs slot", () => {
    const s = fresh();
    const low: Snapshot = { ...s, resources: { ...s.resources, water: 1 }, rates: { ...s.rates, water: -1 } };
    expect(cell(low, "res:water").level).toBe("warn");
    expect(cell(low, "res:water").dir).toBe("down");
    const out: Snapshot = { ...low, resources: { ...low.resources, water: 0.2 } };
    expect(cell(out, "res:water").level).toBe("bad");
    const n = needs({ ...out, resources: { ...out.resources, meals: 1, rations: 0 }, rates: { ...out.rates, meals: -1, rations: 0 } });
    expect(n[0]).toMatchObject({ id: "res:water", level: "bad", open: { trend: "water" } });
    expect(n.find((x) => x.id === "res:food")?.level).toBe("warn");
    expect(n[0]!.text).toBe("Water out in 4.8 h");
    expect(needs({ ...out, resources: { ...out.resources, water: 0 } })[0]!.text).toBe("Out of water");
    expect(n.find((x) => x.id === "res:food")!.text).toMatch(/^Food out in 2[34] h$/);
  });

  it("meals and rations share one cell in Food: their sum, each in the tooltip", () => {
    const s = fresh();
    const both: Snapshot = { ...s, resources: { ...s.resources, meals: 12, rations: 30 }, rates: { ...s.rates, meals: 0, rations: -1 } };
    const groups = barItems(both);
    expect(GROUPS).toEqual(["Colony", "Life", "Food", "Materials"]);
    const ids = groups.map((g) => g.map((i) => i.id));
    expect(ids[2]!.slice(0, 3)).toEqual(["res:food", "res:rawFood", "res:soil"]);
    expect(ids.flat()).not.toContain("res:meals");
    expect(ids.flat()).not.toContain("res:rations");
    const food = cell(both, "res:food");
    expect(food.value).toBe("42");
    expect(food.level).toBe("ok");
    expect(food.notes.some((n) => n.startsWith("Meals: 12 of"))).toBe(true);
    expect(food.notes.some((n) => n.startsWith("Earth rations: 30 of"))).toBe(true);
  });

  it("out of meals is trouble even with rations in store", () => {
    const s = fresh();
    const f = cell({ ...s, resources: { ...s.resources, meals: 0, rations: 100 }, rates: { ...s.rates, meals: -1, rations: 0 } }, "res:food");
    expect(f.level).toBe("bad");
    expect(f.alert).toBe("Out of meals: cook the rations");
  });

  it("power short reads as a worry on battery and trouble once it's flat", () => {
    const s = fresh();
    const short: Snapshot = { ...s, power: { ...s.power, made: 1, used: 5 }, resources: { ...s.resources, power: 10 } };
    expect(cell(short, "res:power:flow").level).toBe("warn");
    expect(cell({ ...short, resources: { ...short.resources, power: 0 } }, "res:power:flow").level).toBe("bad");
  });

  it("people waiting at the office and a storm coming show in the needs slot", () => {
    const s = fresh();
    const n = needs({ ...s, office: { ...s.office, waiting: [s.office.waiting[0] ?? ({} as never)] }, weather: { ...s.weather, storm: 0, dueInDays: 1.5 } });
    expect(n.find((x) => x.id === "office")).toMatchObject({ open: { office: true } });
    expect(n.find((x) => x.id === "storm")?.text).toBe("Storm in 1.5 months");
  });

  it("the drill and drop read compactly", () => {
    const x = topExtras(fresh());
    expect(x.drill.text.length).toBeLessThanOrEqual(8);
    expect(x.drop.text).toMatch(/^~/);
  });
});
