import { afterEach, describe, expect, it } from "vitest";
import raw from "../data/sounds.json";
import { happeningsSince, heard, messageHappening, type Heard } from "../src/audio/cues";
import type { Message } from "../src/sim/messages";
import type { Snapshot } from "../src/sim/snapshot";
import { DEFAULT_SETTINGS, loadSettings } from "../src/ui/settings";

// T-066: audio buses and one table of what sounds when.

const msg = (tick: number, text: string, kind: Message["kind"] = "info"): Message => ({ tick, text, kind });
const snap = (gameId: number, messages: Message[], floors: number) => ({ gameId, messages, layout: { hole: { floors }, rooms: [] } }) as unknown as Snapshot;

describe("sound cues", () => {
  it("every happening plays a known effect, and every message rule names a happening", () => {
    const sfx = ["click", "build", "demolish", "refuse", "landing", "chime", "alert", "floor"];
    for (const v of Object.values(raw.happenings)) expect(v === null || sfx.includes(v)).toBe(true);
    for (const r of raw.messages) expect(r.is in raw.happenings).toBe(true);
  });

  it("matches messages by the first rule that fits", () => {
    expect(messageHappening(msg(0, "Supply drop landed: 40 metal.", "warn"))).toBe("supplyDrop");
    expect(messageHappening(msg(0, "A farmer is waiting at the office."))).toBe("visitor");
    expect(messageHappening(msg(0, "Power is short.", "warn"))).toBe("warning");
    expect(messageHappening(msg(0, "Milestone: fifty people.", "good"))).toBeNull();
  });

  it("hears only what's new, and nothing from a new or loaded game", () => {
    const before: Heard = heard(snap(1, [msg(5, "Old warning", "warn")], 2));
    const now = snap(1, [msg(5, "Old warning", "warn"), msg(9, "Supply drop landed."), msg(9, "Quiet news")], 3);
    expect(happeningsSince(before, now)).toEqual(["supplyDrop", "floorDug"]);
    expect(happeningsSince(before, snap(2, now.messages, 3))).toEqual([]);
    expect(happeningsSince(null, now)).toEqual([]);
  });
});

describe("sound settings", () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  const store = (value: unknown) => {
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(value), setItem: () => {} };
  };

  it("has a volume for master, music, effects and ambience; music on at a medium volume", () => {
    expect(DEFAULT_SETTINGS.volume).toBe(0.6);
    expect(DEFAULT_SETTINGS.music).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.music).toBeLessThan(1);
    expect(DEFAULT_SETTINGS.effects).toBe(1);
    expect(DEFAULT_SETTINGS.ambience).toBe(1);
  });

  it("old on/off switches carry over: off becomes silent, on the default", () => {
    store({ volume: 0.3, sfx: false, ambient: true });
    const s = loadSettings();
    expect(s).toMatchObject({ volume: 0.3, effects: 0, ambience: DEFAULT_SETTINGS.ambience, music: DEFAULT_SETTINGS.music });
    expect("sfx" in s || "ambient" in s).toBe(false);
    store({ effects: 0.4, ambience: 0.2 });
    expect(loadSettings()).toMatchObject({ effects: 0.4, ambience: 0.2 });
  });
});
