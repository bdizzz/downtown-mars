import type { SaveSummary } from "../sim/save";
import { gunzip, gzip } from "../sim/pack";
import { storageKey } from "./storageKey";
import { monthLabel } from "../view/months";

// Saves live in IndexedDB, gzipped (#533): it holds hundreds of megabytes,
// where localStorage holds about 5 MB an origin. localStorage keeps only the
// slot list (each slot's summary and time), so the menu can draw at once
// without opening the database. Saves from before #533 were plain JSON in
// localStorage; `openSaves` copies them across the first time, and removes
// each only once its copy reads back.
//
// Every access can fail (private windows, blocked storage, full quota), so
// each one is guarded and failure is reported rather than crashing the game.

export const SLOTS = ["autosave", "slot1", "slot2", "slot3"] as const;
export type Slot = (typeof SLOTS)[number];

/** What the slot list holds for a save. */
export interface SaveEntry {
  summary: SaveSummary;
  savedAt: number;
}

/** A save as the game reads and writes it: its text, plain. */
export interface StoredSave extends SaveEntry {
  data: string;
}

/** A save as the database holds it. */
export interface SaveRecord extends SaveEntry {
  gz: Uint8Array;
}

/** Where saves are kept: IndexedDB in the game, a Map in tests. */
export interface SaveStore {
  get(slot: Slot): Promise<SaveRecord | undefined>;
  put(slot: Slot, record: SaveRecord): Promise<void>;
  delete(slot: Slot): Promise<void>;
  all(): Promise<[Slot, SaveRecord][]>;
}

/** The bits of localStorage used here (a Map stands in for it in tests). */
export type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DB_NAME = storageKey("saves");
const STORE = "saves";
const isSlot = (s: unknown): s is Slot => (SLOTS as readonly unknown[]).includes(s);

/** The game's store: one IndexedDB object store keyed by slot. Opened on first use. */
export function indexedDbStore(): SaveStore {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("The save database is blocked by another tab."));
    }).catch((e: unknown) => {
      db = null; // Try again next time.
      throw e;
    }));
  const run = async <T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const tx = (await open()).transaction(STORE, mode);
    const req = act(tx.objectStore(STORE));
    return new Promise<T>((resolve, reject) => {
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  };
  return {
    get: (slot) => run("readonly", (s) => s.get(slot) as IDBRequest<SaveRecord | undefined>),
    put: async (slot, record) => void (await run("readwrite", (s) => s.put(record, slot))),
    delete: async (slot) => void (await run("readwrite", (s) => s.delete(slot))),
    all: async () => {
      const [keys, values] = await Promise.all([
        run("readonly", (s) => s.getAllKeys()),
        run("readonly", (s) => s.getAll() as IDBRequest<SaveRecord[]>),
      ]);
      return keys.flatMap((k, i) => (isSlot(k) && values[i] ? [[k, values[i]] as [Slot, SaveRecord]] : []));
    },
  };
}

const listKey = storageKey("saves");
/** Where a slot's save was kept before #533. */
const legacyKey = (slot: Slot) => storageKey(`save.${slot}`);

export interface Saves {
  /** Copies old localStorage saves across and brings the slot list up to date. Safe to call often; it runs once. */
  open(): Promise<void>;
  /** Each slot's summary, or null if it's empty. Synchronous: it reads the slot list, not the saves. */
  list(): Record<Slot, SaveEntry | null>;
  read(slot: Slot): Promise<StoredSave | null>;
  write(slot: Slot, save: StoredSave): Promise<boolean>;
  remove(slot: Slot): Promise<void>;
}

export function createSaves(getStore: () => SaveStore, getStorage: () => KeyValue): Saves {
  const empty = (): Record<Slot, SaveEntry | null> => Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<Slot, SaveEntry | null>;
  const guard = <T>(f: () => T, fallback: T): T => {
    try {
      return f();
    } catch {
      return fallback;
    }
  };
  let store: SaveStore | null = null;
  const db = () => (store ??= getStore());
  const storage = () => getStorage();

  // The slot list, as last read from localStorage or the database.
  let index: Record<Slot, SaveEntry | null> | null = null;
  const loadIndex = (): Record<Slot, SaveEntry | null> => {
    const out = empty();
    const raw = guard(() => storage().getItem(listKey), null);
    const parsed = raw ? guard(() => JSON.parse(raw) as Partial<Record<Slot, SaveEntry>>, {}) : {};
    for (const s of SLOTS) out[s] = parsed[s] ?? null;
    return out;
  };
  const setEntry = (slot: Slot, entry: SaveEntry | null) => {
    index ??= loadIndex();
    index[slot] = entry;
    const kept = Object.fromEntries(SLOTS.flatMap((s) => (index![s] ? [[s, index![s]]] : [])));
    guard(() => storage().setItem(listKey, JSON.stringify(kept)), undefined);
  };

  const readLegacy = (slot: Slot): StoredSave | null => {
    const raw = guard(() => storage().getItem(legacyKey(slot)), null);
    return raw ? guard(() => JSON.parse(raw) as StoredSave, null) : null;
  };

  const put = async (slot: Slot, save: StoredSave): Promise<void> => {
    await db().put(slot, { gz: await gzip(save.data), summary: save.summary, savedAt: save.savedAt });
  };

  const fromRecord = async (r: SaveRecord): Promise<StoredSave> => ({ data: await gunzip(r.gz), summary: r.summary, savedAt: r.savedAt });

  let opening: Promise<void> | null = null;
  const open = () =>
    (opening ??= (async () => {
      // Copy each old save across; remove it only once the copy reads back the same.
      for (const slot of SLOTS) {
        const old = readLegacy(slot);
        if (!old) continue;
        try {
          const there = await db().get(slot);
          // A newer save in the database already (another tab moved it): keep that one.
          if (!there || there.savedAt < old.savedAt) await put(slot, old);
          const back = await db().get(slot);
          if (back && (back.savedAt > old.savedAt || (await gunzip(back.gz)) === old.data)) {
            guard(() => storage().removeItem(legacyKey(slot)), undefined);
          }
        } catch {
          // The database isn't usable: the old save stays where it was, and is still read from there.
        }
      }
      // The database is the truth for what's in each slot; old saves it couldn't take still count.
      const found = empty();
      const all = await db().all().catch(() => [] as [Slot, SaveRecord][]);
      for (const [slot, r] of all) found[slot] = { summary: r.summary, savedAt: r.savedAt };
      for (const slot of SLOTS) {
        const old = found[slot] ? null : readLegacy(slot);
        if (old) found[slot] = { summary: old.summary, savedAt: old.savedAt };
      }
      for (const slot of SLOTS) setEntry(slot, found[slot]);
    })());

  return {
    open,
    list: () => ({ ...(index ??= loadIndex()) }),
    read: async (slot) => {
      await open();
      try {
        const r = await db().get(slot);
        if (r) return await fromRecord(r);
      } catch {
        // Fall through to an old save, if there is one.
      }
      return readLegacy(slot);
    },
    write: async (slot, save) => {
      await open();
      try {
        await put(slot, save);
      } catch {
        return false;
      }
      setEntry(slot, { summary: save.summary, savedAt: save.savedAt });
      // An old save left behind (the database was down when it was copied) would otherwise come back.
      guard(() => storage().removeItem(legacyKey(slot)), undefined);
      return true;
    },
    remove: async (slot) => {
      await open();
      await db().delete(slot).catch(() => undefined);
      guard(() => storage().removeItem(legacyKey(slot)), undefined);
      setEntry(slot, null);
    },
  };
}

const saves = createSaves(indexedDbStore, () => localStorage);

export const openSaves = (): Promise<void> => saves.open();
export const listSaves = (): Record<Slot, SaveEntry | null> => saves.list();
export const readSave = (slot: Slot): Promise<StoredSave | null> => saves.read(slot);
export const writeSave = (slot: Slot, save: StoredSave): Promise<boolean> => saves.write(slot, save);
export const deleteSave = (slot: Slot): Promise<void> => saves.remove(slot);

export function slotLabel(slot: Slot): string {
  return slot === "autosave" ? "Autosave" : `Slot ${slot.slice(4)}`;
}

export function describeSave(s: SaveEntry): string {
  const when = new Date(s.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const holes = (s.summary.holes ?? 1) > 1 ? ` · ${s.summary.holes} holes` : "";
  const failed = s.summary.failed ? "Failed · " : "";
  return `${failed}${monthLabel(s.summary.day)} · ${s.summary.population} colonists${holes} · ${s.summary.floors} floors · ${when}`;
}

/** Offer a save as a .json download: plain text, so it opens anywhere and imports as before. */
export function downloadSave(s: StoredSave): void {
  const blob = new Blob([s.data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `downtown-mars-month-${s.summary.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ask for a .json file and return its text, or null if cancelled. */
export function pickSaveFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    // Kept in the document while the dialog is open: a detached input can be
    // garbage-collected by Chrome and Safari before its change event fires.
    document.body.appendChild(input);
    const done = (text: string | null) => {
      input.remove();
      resolve(text);
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      file.text().then(done, () => done(null));
    });
    input.addEventListener("cancel", () => done(null));
    input.click();
  });
}
