// Every localStorage key the game uses. A PR's preview build is served from
// the same origin as the main game (bdizzz.github.io), so the preview
// workflow sets VITE_STORAGE_PREFIX to keep its saves and settings apart.
// The bridge imports some of the UI modules under plain Node, where
// import.meta.env doesn't exist, hence the guard.

const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const PREFIX = env?.VITE_STORAGE_PREFIX ?? "";

export const storageKey = (name: string): string => `${PREFIX}downtown-mars.${name}`;
