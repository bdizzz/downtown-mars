/// <reference types="vite/client" />
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

/** Whether this build offers the dev games: the dev server, or a PR's preview build (a function, so Node scripts can import the list). */
export function devGamesShown(): boolean {
  const env = import.meta.env;
  return !!env && (env.DEV || /^\d+$/.test(String(env.VITE_PR_NUMBER ?? "")));
}

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
