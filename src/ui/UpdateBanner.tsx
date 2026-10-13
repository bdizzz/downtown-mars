import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Offline play and updates (T-064). The service worker (vite.config.ts
// offline()) keeps the game for offline play; when a newer build is out it
// downloads in the background and waits, and this banner offers it. Nothing
// changes until the player taps Update: in a game it autosaves first, then
// reloads into the new version (saves live in local storage, so they carry
// over). It checks for a new build when the game comes back to the foreground
// and every so often while it runs. Built games only: the dev server and PR
// previews register no service worker, so the banner never shows there.

/** How often a running game checks for a new build. */
const CHECK_MS = 60 * 60 * 1000;

interface Props {
  /** Mid-game, saves the game before the update reloads it; null on the title. */
  saveFirst: (() => Promise<unknown>) | null;
}

export function UpdateBanner({ saveFirst }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    needRefresh: [ready, setReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, reg) {
      if (!reg) return;
      const check = () => {
        // Not while offline (it would only fail), nor while the worker is still installing.
        if (!navigator.onLine || reg.installing) return;
        void fetch(url, { cache: "no-store" }).then(
          (r) => {
            if (r.ok) void reg.update();
          },
          () => {},
        );
      };
      setInterval(check, CHECK_MS);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    },
    onRegisterError() {
      // No service worker here (a sandboxed frame, a private window): the game plays online as before.
    },
  });

  // Which version is waiting: the new build's version.json, fetched past every cache.
  useEffect(() => {
    if (!ready) return;
    fetch("./version.json", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ version?: string }>) : null))
      .then((v) => setVersion(v?.version?.split(" · ")[0] ?? null), () => {});
  }, [ready]);

  if (!ready) return null;
  const update = async () => {
    setBusy(true);
    if (saveFirst) await saveFirst();
    await updateServiceWorker(true);
  };
  return (
    <div className="update-banner" role="status">
      <span>
        A new version is ready{version ? ` (${version})` : ""}.
      </span>
      <button className="primary" disabled={busy} onClick={update} title={saveFirst ? "Saves the game, then reloads into the new version" : "Reloads into the new version"}>
        {busy ? "Updating…" : "Update"}
      </button>
      <button className="update-later" onClick={() => setReady(false)} aria-label="Not now">
        ✕
      </button>
    </div>
  );
}
