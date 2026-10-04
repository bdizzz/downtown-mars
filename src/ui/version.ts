import { useEffect, useState } from "react";

declare const __APP_VERSION__: string;

/** e.g. "v0.2.0 · 1a2b3c4", injected at build time by vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** How often the dev server is asked for its branch, in ms. */
const BRANCH_POLL_MS = 5000;

/**
 * The git branch the dev server is serving (vite.config.ts gitBranch), kept
 * fresh: asked every few seconds and when the window comes back into focus.
 * Null in a built game, or when the server doesn't say.
 */
export function useGitBranch(): string | null {
  const [branch, setBranch] = useState<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let live = true;
    const ask = () =>
      fetch("/__dev/branch", { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : ""))
        .then((name) => live && setBranch(name.trim() || null))
        .catch(() => live && setBranch(null));
    void ask();
    const timer = setInterval(ask, BRANCH_POLL_MS);
    window.addEventListener("focus", ask);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", ask);
    };
  }, []);
  return branch;
}
