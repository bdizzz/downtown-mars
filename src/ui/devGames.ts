/// <reference types="vite/client" />
import { isDevBuild } from "./devBuild";
// The dev games (#351): the dev saves in public/ (T-013, written by `npm run saves`),
// offered in the menu's Load… screen so a tester can jump to a game at a given stage
// without hunting for a file or playing for an hour. The dev server and PR previews
// show them; the release leaves them out (vite.config.ts dropDevSaves).

export interface DevGame {
  /** The file is public/dev-save-<name>.json. */
  name: string;
  /** The game day the bot's run is saved at. */
  day: number;
  /** One line for the menu: what's in it. */
  what: string;
}

/** In order of play. scripts/saves.ts writes these from the network bot's run. */
export const DEV_GAMES: readonly DevGame[] = [
  { name: "early", day: 5, what: "the first rooms and corridors" },
  { name: "mid", day: 30, what: "one hole, furnished, windows, a few events seen" },
  { name: "network", day: 60, what: "two holes, a few days after founding, rovers running both ways" },
  { name: "late", day: 120, what: "as big as the bots get while both holes are healthy" },
];

/** Whether this build offers the dev games: the dev server, or a PR's preview build. */
export const devGamesShown = isDevBuild;

export const devGameLabel = (g: DevGame): string => g.name[0]!.toUpperCase() + g.name.slice(1);

/** The dev game's save file, as text; null when it can't be fetched. */
export async function fetchDevGame(g: DevGame): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}dev-save-${g.name}.json`, { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

/**
 * The game the address asks to open straight into (#518), skipping the title: `?game=mid` for a dev
 * game, or `?game=saves/my-game.json` for a save file served by the same server (public/). The file's
 * address, or null when there's no such parameter, it names nothing, or this build doesn't offer dev games.
 */
export function gameFromUrl(search: string, shown = devGamesShown()): string | null {
  const want = new URLSearchParams(search).get("game")?.trim();
  if (!want || !shown) return null;
  const base = import.meta.env?.BASE_URL ?? "/";
  const dev = DEV_GAMES.find((g) => g.name === want.toLowerCase());
  if (dev) return `${base}dev-save-${dev.name}.json`;
  // Only a path on this server: no scheme, no other host, no climbing out.
  if (!/\.json$/i.test(want) || /[:\\]|^\/\/|(^|\/)\.\.(\/|$)/.test(want)) return null;
  return want.startsWith("/") ? want : `${base}${want}`;
}

/** The save file at that address, as text; null when it can't be fetched. */
export async function fetchGameAt(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}
