import { useState } from "react";
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
  error: string | null;
  tutorialHidden: boolean;
  onShowTutorial: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  onHelp: () => void;
}

type Confirm = { text: string; run: () => void } | null;

export function Menu(props: Props) {
  const { mode, onResume, onNewGame, onSave, onLoad, onExport, onImport, error, tutorialHidden, onShowTutorial } = props;
  const [view, setView] = useState<"main" | "save" | "load" | "settings">("main");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const branch = useGitBranch();
  // Re-read storage on every render: saves change underneath us.
  const saves = Object.fromEntries(SLOTS.map((s) => [s, readSave(s)])) as Record<Slot, ReturnType<typeof readSave>>;
  const auto = saves.autosave;
  const inGame = mode === "pause";

  const ask = (text: string, run: () => void) => setConfirm({ text, run });

  return (
    <div className="menu-backdrop">
      <div className="menu" role="dialog" aria-label={inGame ? "Game menu" : "Downtown Mars"}>
        {mode === "title" ? (
          <header className="menu-title">
            <h1>Downtown Mars</h1>
            <p>Hole sweet hole.</p>
          </header>
        ) : (
          <h2>Paused</h2>
        )}

        {error && <p className="menu-error">{error}</p>}

        {confirm ? (
          <div className="menu-confirm">
            <p>{confirm.text}</p>
            <button
              className="primary"
              onClick={() => {
                confirm.run();
                setConfirm(null);
              }}
            >
              Yes
            </button>
            <button onClick={() => setConfirm(null)}>No</button>
          </div>
        ) : view === "settings" ? (
          <SettingsView settings={props.settings} update={props.updateSettings} onBack={() => setView("main")} />
        ) : view === "main" ? (
          <div className="menu-buttons">
            {inGame && (
              <button className="primary" onClick={onResume}>
                Resume
              </button>
            )}
            {!inGame && auto && (
              <button className="primary" onClick={() => onLoad("autosave")} title={describeSave(auto)}>
                Continue
                <span className="sub">{describeSave(auto)}</span>
              </button>
            )}
            <button
              className={!inGame && !auto ? "primary" : ""}
              onClick={() => (inGame ? ask("Start a new game? Unsaved progress since the last autosave is lost.", onNewGame) : onNewGame())}
            >
              New game
            </button>
            {inGame && <button onClick={() => setView("save")}>Save…</button>}
            <button onClick={() => setView("load")}>Load…</button>
            {inGame && <button onClick={onExport}>Export save file</button>}
            <button onClick={onImport}>Import save file…</button>
            {inGame && tutorialHidden && <button onClick={onShowTutorial}>Show tutorial</button>}
            <button onClick={() => setView("settings")}>Settings…</button>
            <button onClick={props.onHelp}>Controls</button>
          </div>
        ) : (
          <div className="menu-buttons">
            {(view === "save" ? SLOTS.filter((s) => s !== "autosave") : SLOTS).map((slot) => {
              const existing = saves[slot];
              const act = () =>
                view === "save"
                  ? existing
                    ? ask(`Overwrite ${slotLabel(slot)}?`, () => onSave(slot))
                    : onSave(slot)
                  : inGame
                    ? ask(`Load ${slotLabel(slot)}? Unsaved progress is lost.`, () => onLoad(slot))
                    : onLoad(slot);
              return (
                <button key={slot} disabled={view === "load" && !existing} onClick={act}>
                  {slotLabel(slot)}
                  <span className="sub">{existing ? describeSave(existing) : "Empty"}</span>
                </button>
              );
            })}
            <button onClick={() => setView("main")}>Back</button>
          </div>
        )}
        <p className="menu-version">
          {branch && (
            <span className="menu-branch" title={`Git branch: ${branch} (dev server only)`}>
              git: {branch}
            </span>
          )}
          <span>{APP_VERSION}</span>
        </p>
      </div>
    </div>
  );
}
