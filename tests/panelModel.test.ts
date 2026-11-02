import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { deserialize } from "../src/sim/save";
import { makeSnapshot, type Snapshot } from "../src/sim/snapshot";
import { createInitialState } from "../src/sim/state";
import { isIcon } from "../src/view/icons";
import { panelModel, panelRows } from "../src/view/roomPanel";
import { roomTone, statusWord } from "../src/view/roomState";

// The room panel as one model (F-019 step 1, #306): every room gives one, and it holds exactly the
// rows the viewers draw today, sorted into sections, with every warning raised as an alert.

const files = import.meta.glob<string>("../public/dev-save-*.json", { query: "?raw", import: "default", eager: true });
const snaps: [string, Snapshot][] = Object.entries(files).flatMap(([path, json]) => {
  const r = deserialize(json);
  if (!r.ok) throw new Error(r.reason);
  return r.world.holes.map((hole, i) => [`${path.split("/").pop()!} hole ${i + 1}`, makeSnapshot(hole, config)] as [string, Snapshot]);
});
snaps.push(["a fresh game", makeSnapshot(createInitialState(config), config)]);

const TONES = ["good", "idle", "warn", "bad", "info"];

describe("the room panel model (#306)", () => {
  it.each(snaps)("every room in %s gives a whole model", (_name, s) => {
    expect(s.layout.rooms.length).toBeGreaterThan(0);
    for (const room of s.layout.rooms) {
      const m = panelModel(s, room);
      expect(TONES, room.type).toContain(m.status.tone);
      // A room with no work (the landing pod) has no state line today, and no pill.
      if (!m.status.tip) expect(m.status, room.type).toEqual({ text: "", tone: "idle", tip: "" });
      else expect(m.status.text, room.type).toBeTruthy();
      const icons = [...m.headline, ...m.glance].map((c) => c.icon).concat(m.sections.map((x) => x.icon), m.sections.flatMap((x) => x.rows.flatMap((r) => (r.icon ? [r.icon] : []))));
      for (const icon of icons) expect(isIcon(icon), icon).toBe(true);
      expect(new Set(m.sections.map((x) => x.id)).size).toBe(m.sections.length);
    }
  });

  it.each(snaps)("in %s, every row the panel shows today lands in exactly one section", (_name, s) => {
    for (const room of s.layout.rooms) {
      const flat = panelRows(s, room);
      const sectioned = panelModel(s, room).sections.flatMap((x) => x.rows);
      const today = [...flat.before, ...flat.after];
      expect(sectioned.map((r) => `${r.k}|${r.text}`).sort(), room.type).toEqual(today.map((r) => `${r.k}|${r.text}`).sort());
    }
  });

  it.each(snaps)("in %s, every warning is also an alert, and open", (_name, s) => {
    for (const room of s.layout.rooms) {
      const m = panelModel(s, room);
      for (const section of m.sections) {
        for (const row of section.rows.filter((r) => r.warn)) {
          expect(m.alerts.some((a) => a.section === section.id && a.text.includes(row.text)), `${room.type}: ${row.text}`).toBe(true);
          expect(section.open).toBe(true);
        }
      }
    }
  });

  it("a room cut off from the corridors says so in red, with Connect beside it", () => {
    const s = makeSnapshot(createInitialState(config), config);
    const room = { ...s.layout.rooms.find((r) => r.at.kind === "ring" && !r.planned)!, connected: false };
    const m = panelModel(s, room);
    expect(m.status).toMatchObject({ text: "Cut off", tone: "bad" });
    expect(m.alerts[0]).toMatchObject({ tone: "bad", action: "connect" });
  });

  it("tones: running green, resting gray, slowed amber, short of an input red, unbuilt blue", () => {
    const built = { planned: false, connected: true };
    expect(roomTone(built, { rate: 1 })).toBe("good");
    expect(roomTone(built, { rate: 0, limit: "paused" })).toBe("idle");
    expect(roomTone(built, { rate: 0, limit: "full:water" })).toBe("idle");
    expect(roomTone(built, { rate: 0.5, limit: "staff" })).toBe("warn");
    expect(roomTone(built, { rate: 0, limit: "water" })).toBe("bad");
    expect(roomTone(built, { rate: 0, limit: "broken" })).toBe("bad");
    // Quiet hours slow noisy rooms; at full rate a leftover limit holds nothing back (#310).
    expect(roomTone(built, { rate: 0.95, limit: "ordinance" })).toBe("warn");
    expect(roomTone(built, { rate: 1, limit: "power" })).toBe("good");
    expect(roomTone({ planned: true, connected: false }, undefined)).toBe("info");
    const room = makeSnapshot(createInitialState(config), config).layout.rooms[0]!;
    expect(statusWord({ ...room, planned: false, connected: true }, { staff: 0, staffNeeded: 1, rate: 0, limit: "water" })).toBe("Short of water");
    expect(statusWord({ ...room, planned: false, connected: true }, { staff: 1, staffNeeded: 1, rate: 0.95, limit: "ordinance" })).toBe("Slowed");
    expect(statusWord({ ...room, planned: false, connected: true }, { staff: 1, staffNeeded: 1, rate: 1, limit: "power" })).toBe("Running");
  });
});
