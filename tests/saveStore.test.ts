import { describe, expect, it } from "vitest";
import { gunzip, gzip, packColumn, unpackColumn } from "../src/sim/pack";
import { serialize } from "../src/sim/save";
import { construction } from "../src/sim/construction";
import { storage as storageRules } from "../src/sim/storage";
import { createSaves, type KeyValue, type SaveRecord, type SaveStore, type Slot, type StoredSave } from "../src/ui/saves";
import { storageKey } from "../src/ui/storageKey";
import { runNetwork } from "./netbot";

// Saves in IndexedDB, packed and gzipped (#533, docs/PLAN-PEOPLE.md "Saves").

/** A Map standing in for IndexedDB; `broken` makes every call fail, as in a private window. */
function memoryStore(broken = false): SaveStore & { map: Map<Slot, SaveRecord> } {
  const map = new Map<Slot, SaveRecord>();
  const ok = async () => {
    if (broken) throw new Error("no database");
  };
  return {
    map,
    get: async (slot) => (await ok(), map.get(slot)),
    put: async (slot, r) => (await ok(), void map.set(slot, r)),
    delete: async (slot) => (await ok(), void map.delete(slot)),
    all: async () => (await ok(), [...map]),
  };
}

function memoryStorage(): KeyValue & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const save = (day: number, savedAt = day): StoredSave => ({
  data: JSON.stringify({ game: "downtown-mars", day, filler: "rock ".repeat(200) }),
  summary: { day, population: 10 * day, floors: 2, holes: 1 },
  savedAt,
});

describe("packing typed-array columns", () => {
  it.each([
    ["Uint8Array", new Uint8Array([0, 1, 254, 255])],
    ["Int16Array", new Int16Array([-32768, -1, 0, 1, 32767])],
    ["Uint32Array", new Uint32Array([0, 1, 2 ** 32 - 1])],
    ["Float32Array", new Float32Array([0.5, -1.25, 1e10])],
    ["Float64Array", new Float64Array([Math.PI, -0, Number.MAX_VALUE])],
  ] as const)("%s round-trips", (_name, column) => {
    const text = packColumn(column);
    expect(text).toMatch(/^[A-Za-z0-9+/]*=*$/);
    const back = unpackColumn(text, column.constructor as never);
    expect(Array.from(back as ArrayLike<number>)).toEqual([...column]);
    expect(back.constructor).toBe(column.constructor);
  });

  it("packs a view of part of a buffer, not the whole buffer", () => {
    const whole = new Uint16Array([1, 2, 3, 4, 5]);
    expect([...unpackColumn(packColumn(whole.subarray(1, 3)), Uint16Array)]).toEqual([2, 3]);
  });

  it("packs 10,000 people's worth without hitting the call stack's limit, at 4/3 of its bytes", () => {
    const ages = new Uint32Array(100_000).map((_, i) => i * 7);
    const text = packColumn(ages);
    expect(text.length).toBe(Math.ceil((ages.byteLength * 4) / 3 / 4) * 4);
    expect(unpackColumn(text, Uint32Array)).toEqual(ages);
  });

  it("refuses bytes that don't fit the type", () => {
    expect(() => unpackColumn(packColumn(new Uint8Array(3)), Uint16Array)).toThrow();
  });
});

describe("gzip", () => {
  it("round-trips text, including non-ASCII", async () => {
    const text = `Ünderground · 地下 · ${"hole sweet hole ".repeat(500)}`;
    const gz = await gzip(text);
    expect(gz.length).toBeLessThan(text.length / 10);
    expect(await gunzip(gz)).toBe(text);
  });

  it("rejects bytes that aren't gzip", async () => {
    await expect(gunzip(new TextEncoder().encode("{}"))).rejects.toThrow();
  });
});

describe("the save store", () => {
  it("writes gzipped to the store, lists from localStorage, and reads back", async () => {
    const store = memoryStore();
    const ls = memoryStorage();
    const saves = createSaves(() => store, () => ls);
    expect(await saves.write("slot1", save(3))).toBe(true);
    expect(store.map.get("slot1")!.gz.length).toBeLessThan(save(3).data.length);
    expect(ls.map.get(storageKey("save.slot1"))).toBeUndefined();
    expect(saves.list().slot1).toEqual({ summary: save(3).summary, savedAt: 3 });
    expect(saves.list().slot2).toBeNull();
    expect(await saves.read("slot1")).toEqual(save(3));
    expect(await saves.read("slot2")).toBeNull();
    // A fresh page sees the slot list straight from localStorage, before the database opens.
    expect(createSaves(() => memoryStore(true), () => ls).list().slot1?.savedAt).toBe(3);
    await saves.remove("slot1");
    expect(saves.list().slot1).toBeNull();
    expect(await saves.read("slot1")).toBeNull();
  });

  it("copies old localStorage saves across once, removing each only after it reads back", async () => {
    const store = memoryStore();
    const ls = memoryStorage();
    ls.setItem(storageKey("save.autosave"), JSON.stringify(save(7)));
    ls.setItem(storageKey("save.slot2"), JSON.stringify(save(4)));
    ls.setItem(storageKey("settings"), "{}");
    const saves = createSaves(() => store, () => ls);
    await saves.open();
    expect([...store.map.keys()].sort()).toEqual(["autosave", "slot2"]);
    expect(ls.map.has(storageKey("save.autosave"))).toBe(false);
    expect(ls.map.has(storageKey("save.slot2"))).toBe(false);
    expect(ls.map.has(storageKey("settings"))).toBe(true);
    expect(saves.list().autosave?.summary.day).toBe(7);
    expect(await saves.read("slot2")).toEqual(save(4));
  });

  it("leaves old saves in place, and still reads them, when the database won't open", async () => {
    const ls = memoryStorage();
    ls.setItem(storageKey("save.slot1"), JSON.stringify(save(5)));
    const saves = createSaves(() => memoryStore(true), () => ls);
    await saves.open();
    expect(ls.map.has(storageKey("save.slot1"))).toBe(true);
    expect(saves.list().slot1?.summary.day).toBe(5);
    expect(await saves.read("slot1")).toEqual(save(5));
    expect(await saves.write("slot2", save(6))).toBe(false);
  });

  it("keeps the old save when its copy doesn't read back the same", async () => {
    const store = memoryStore();
    const put = store.put;
    store.put = (slot, r) => put(slot, { ...r, gz: new Uint8Array(r.gz.subarray(0, 10)) });
    const ls = memoryStorage();
    ls.setItem(storageKey("save.slot1"), JSON.stringify(save(5)));
    await createSaves(() => store, () => ls).open();
    expect(ls.map.has(storageKey("save.slot1"))).toBe(true);
  });

  it("doesn't let an old save overwrite a newer one already in the database", async () => {
    const store = memoryStore();
    const ls = memoryStorage();
    await createSaves(() => store, () => ls).write("slot1", save(9, 900));
    ls.setItem(storageKey("save.slot1"), JSON.stringify(save(2, 200)));
    const saves = createSaves(() => store, () => ls);
    await saves.open();
    expect((await saves.read("slot1"))?.summary.day).toBe(9);
    expect(ls.map.has(storageKey("save.slot1"))).toBe(false);
  });

  it("rebuilds the slot list from the database when localStorage has lost it", async () => {
    const store = memoryStore();
    await createSaves(() => store, memoryStorage).write("slot3", save(8));
    const saves = createSaves(() => store, memoryStorage);
    expect(saves.list().slot3).toBeNull();
    await saves.open();
    expect(saves.list().slot3?.summary.day).toBe(8);
  });
});

describe("save size", () => {
  // Strict, as decided for size tests (docs/PLAN-PEOPLE.md): the two-hole bot's game at 60 days,
  // plain and gzipped, against limits about 5% over what it measured (Nov 18: 206,934 bytes plain,
  // 42,706 gzipped). If a change grows saves past them, look at why before raising them:
  // whatever can be rebuilt on load shouldn't be saved.
  // Nov 19, #523: the people (91, packed) add 4,916 bytes plain and 2,206 gzipped, all of it who they
  // are, where they sleep and work; limits raised by as much, to 5% over 213,386 and 45,291.
  construction.instant = false;
  storageRules.unlimited = false;
  const LIMIT_PLAIN = 224_000;
  const LIMIT_GZIPPED = 47_500;
  const { world } = runNetwork(60);

  it("a 60-day two-hole game saves under its limits", async () => {
    const text = serialize(world);
    const gz = await gzip(text);
    const sizes = `${world.holes.length} holes, ${world.holes.reduce((n, h) => n + h.population.count, 0)} people: ${text.length} bytes plain, ${gz.length} gzipped`;
    expect(text.length, sizes).toBeLessThan(LIMIT_PLAIN);
    expect(gz.length, sizes).toBeLessThan(LIMIT_GZIPPED);
    expect(await gunzip(gz)).toBe(text);
  });
});
