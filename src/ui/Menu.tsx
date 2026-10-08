import { useEffect, useRef, useState } from "react";
import { describeSave, readSave, SLOTS, slotLabel, type Slot } from "./saves";
import type { Settings } from "./settings";
import { SettingsView } from "./SettingsView";
import { APP_VERSION, useGitBranch } from "./version";

interface Props {
  /** "title" before a game starts; "pause" in the middle of one. */
  mode: "title" | "pause";
  onResume: () => void;
  onNewGame: () => void;
  onSave: (slot: Slot) => void;
  onLoad: (slot: Slot) => void;
  onExport: () => void;
  onImport: () => void;
  onQuitToTitle: () => void;
  error: string | null;
  tutorial: boolean;
  onTutorial: (on: boolean) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  onHelp: () => void;
  /** Help is open over the menu: it takes the keys. */
  covered: boolean;
}

type Confirm = { text: string; yes: string; run: () => void } | null;
type View = "main" | "save" | "load" | "settings";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function Menu(props: Props) {
  const { mode, onResume, onNewGame, onSave, onLoad, onExport, onImport, error } = props;
  const [view, setView] = useState<View>("main");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const box = useRef<HTMLDivElement>(null);
  const branch = useGitBranch();
  // Re-read storage on every render: saves change underneath us.
  const saves = Object.fromEntries(SLOTS.map((s) => [s, readSave(s)])) as Record<Slot, ReturnType<typeof readSave>>;
  const auto = saves.autosave;
  const inGame = mode === "pause";

  const ask = (text: string, yes: string, run: () => void) => setConfirm({ text, yes, run });

  // Each screen opens with its first control focused, so the keyboard starts in the menu.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus() ?? box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [view, confirm === null]);

  const back = () => {
    if (confirm) setConfirm(null);
    else if (view !== "main") setView("main");
    else if (inGame) onResume();
  };

  // On the window, so the keys still work when focus has fallen out of the menu (Help closed over it, say).
  const onKey = (e: KeyboardEvent) => {
    if (props.covered) return;
    if (e.key === "Escape") {
      e.preventDefault();
      back();
      return;
    }
    const all = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    // Tab stays inside the menu.
    if (e.key === "Tab" && all.length) {
      if (at < 0) {
        e.preventDefault();
        all[0]!.focus();
      } else if (e.shiftKey && at === 0) {
        e.preventDefault();
        all[all.length - 1]!.focus();
      } else if (!e.shiftKey && at === all.length - 1) {
        e.preventDefault();
        all[0]!.focus();
      }
      return;
    }
    // Up and down walk the buttons (sliders and lists keep their arrows).
    const tag = (e.target as HTMLElement).tagName;
    const own = tag === "SELECT" || (tag === "INPUT" && (e.target as HTMLInputElement).type === "range") || (e.target as HTMLElement).getAttribute("role") === "tab";
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !own && all.length) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      all[at < 0 ? (step > 0 ? 0 : all.length - 1) : (at + step + all.length) % all.length]!.focus();
    }
  };
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const heading = confirm ? null : view === "settings" ? "Settings" : view === "save" ? "Save to…" : view === "load" ? "Load…" : inGame ? "Paused" : null;

  return (
    <div className="menu-backdrop">
      <div
        ref={box}
        className={`menu${view === "settings" ? " menu-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={heading ?? "Downtown Mars"}
      >
        {mode === "title" && view === "main" && !confirm ? (
          <header className="menu-title">
            <h1>Downtown Mars</h1>
            <p>Hole sweet hole.</p>
          </header>
        ) : (
          heading && <h2>{heading}</h2>
        )}

        {error && (
          <p className="menu-error" role="alert">
            {error}
          </p>
        )}

        {confirm ? (
          <div className="menu-confirm">
            <p>{confirm.text}</p>
            <div className="menu-grid">
              <button
                className="primary"
                data-autofocus
                onClick={() => {
                  confirm.run();
                  setConfirm(null);
                }}
              >
                {confirm.yes}
              </button>
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        ) : view === "settings" ? (
          <SettingsView
            settings={props.settings}
            update={props.updateSettings}
            onBack={() => setView("main")}
            onKeys={props.onHelp}
            tutorial={props.tutorial}
            onTutorial={props.onTutorial}
          />
        ) : view === "main" ? (
          <>
            {inGame ? (
              <button className="primary" data-autofocus onClick={onResume}>
                Resume
              </button>
            ) : auto ? (
              <button className="primary" data-autofocus onClick={() => onLoad("autosave")}>
                Continue
                <span className="sub">{describeSave(auto)}</span>
              </button>
            ) : (
              <button className="primary" data-autofocus onClick={onNewGame}>
                New game
              </button>
            )}
            <div className="menu-grid">
              {inGame && <button onClick={() => setView("save")}>Save…</button>}
              <button onClick={() => setView("load")}>Load…</button>
              {(inGame || auto) && (
                <button onClick={() => (inGame ? ask("Start a new game? Progress since the last autosave is lost.", "New game", onNewGame) : onNewGame())}>New game</button>
              )}
              <button onClick={() => setView("settings")}>Settings…</button>
              <button onClick={props.onHelp}>Help</button>
              {inGame && <button onClick={() => ask("Quit to the title? Progress since the last autosave is lost.", "Quit", props.onQuitToTitle)}>Quit to title</button>}
            </div>
            <div className="menu-links">
              {inGame && <button onClick={onExport}>Export save file</button>}
              <button onClick={onImport}>Import save file…</button>
            </div>
          </>
        ) : (
          <div className="menu-slots">
            {(view === "save" ? SLOTS.filter((s) => s !== "autosave") : SLOTS).map((slot) => {
              const existing = saves[slot];
              const act = () =>
                view === "save"
                  ? existing
                    ? ask(`Overwrite ${slotLabel(slot)}?`, "Overwrite", () => onSave(slot))
                    : onSave(slot)
                  : inGame
                    ? ask(`Load ${slotLabel(slot)}? Unsaved progress is lost.`, "Load", () => onLoad(slot))
                    : onLoad(slot);
              return (
                <button key={slot} disabled={view === "load" && !existing} onClick={act}>
                  {slotLabel(slot)}
                  <span className="sub">{existing ? describeSave(existing) : "Empty"}</span>
                </button>
              );
            })}
            <button className="menu-back" onClick={() => setView("main")}>
              Back
            </button>
          </div>
        )}
        <p className="menu-version">
          {branch && (
            <span className="menu-branch" title={`Git branch: ${branch} (dev server only)`}>
              git: {branch}
            </span>
          )}
          <span>{APP_VERSION}</span>
          <span className="menu-esc" aria-hidden>
            {view !== "main" || confirm ? "Esc: back" : inGame ? "Esc: resume" : ""}
          </span>
        </p>
      </div>
    </div>
  );
}
