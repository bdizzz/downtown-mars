import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { HoverInfo, Tool } from "../view/types";
import type { SimCommand } from "../sim/commands";
import { roomDef, roomDefs } from "../sim/rooms";
import { BuildPalette, buildTool, DEMOLISH_KEY, HOTKEYS, shapesFor } from "./BuildPalette";
import { FlowPanel } from "./FlowPanel";
import { Help } from "./Help";
import { Hud } from "./Hud";
import { Inspector } from "./Inspector";
import { MapScreen, type SitePick } from "./MapScreen";
import { NetworkPanel } from "./NetworkPanel";
import { Menu } from "./Menu";
import { Messages } from "./Messages";
import { Office } from "./Office";
import { OverlayPicker } from "./OverlayPicker";
import { ViewHost } from "./ViewHost";
import { ResourceBar } from "./ResourceBar";
import { downloadSave, pickSaveFile, readSave, slotLabel, writeSave, type Slot } from "./saves";
import { StatusBar } from "./StatusBar";
import { currentGoal, Tutorial } from "./Tutorial";
import { setTutorialHidden, tutorialHidden, type UiFlags } from "./tutorialGoals";
import { play, setAudioSettings, unlockAudio } from "../audio/sound";
import { useSettings } from "./settings";
import { useSim } from "./useSim";
import { useSounds } from "./useSounds";

const NOTICE_MS = 3000;

export function App() {
  const { snapshot, speed, setSpeed, setActiveHole, send, found, route, save, load, newGame } = useSim();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  // The right-hand panel: the office or the flow diagram; the room inspector shows when neither is open.
  const [panel, setPanel] = useState<"office" | "flows" | "network" | null>(null);
  const officeOpen = panel === "office";
  const togglePanel = (p: "office" | "flows" | "network") => {
    setPanel((cur) => (cur === p ? null : p));
    setSelected(null);
  };
  // "title" until the player starts or continues a game; then the pause menu opens over play.
  const [menu, setMenu] = useState<"title" | "pause" | null>("title");
  const [menuError, setMenuError] = useState<string | null>(null);
  const resumeSpeed = useRef(1);
  const [tutorialOn, setTutorialOn] = useState(() => !tutorialHidden());
  const [flags, setFlags] = useState<UiFlags>({ sawNoise: false, openedFlows: false, sawThreeD: false });
  const [settings, updateSettings] = useSettings();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [plannedSite, setPlannedSite] = useState<SitePick | null>(null);

  useSounds(snapshot);
  useEffect(() => setAudioSettings(settings), [settings]);
  // Browsers only allow sound after the player does something.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const noticeTimer = useRef<number>(undefined);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  // Rooms placed this session, newest last, for undo.
  const undoStack = useRef<number[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const onCommand = useCallback(
    async (cmd: SimCommand, quiet = false) => {
      const result = await send(cmd);
      if (!result.ok) {
        if (!quiet) {
          flash(result.reason);
          play("refuse");
        }
      } else if (result.roomId !== undefined) {
        undoStack.current.push(result.roomId);
        setCanUndo(true);
        play("build");
      } else if (cmd.type === "demolish") play("demolish");
    },
    [send, flash],
  );

  const undo = useCallback(async () => {
    const roomId = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (roomId === undefined) return;
    const result = await send({ type: "undoBuild", roomId });
    if (result.ok) play("demolish");
    if (!result.ok) {
      flash(result.reason);
      undoStack.current = []; // older ones are older still
      setCanUndo(false);
    }
  }, [send, flash]);

  const rotate = useCallback(() => {
    setTool((t) => {
      if (t?.kind !== "build") return t;
      const shapes = shapesFor(roomDef(t.room));
      const i = shapes.findIndex(([w, d]) => w === t.shape[0] && d === t.shape[1]);
      return { ...t, shape: shapes[(i + 1) % shapes.length]! };
    });
  }, []);

  // The sim stays paused behind any menu.
  useEffect(() => {
    if (menu) setSpeed(0);
  }, [menu, setSpeed]);

  const openMenu = useCallback(() => {
    resumeSpeed.current = speed || resumeSpeed.current;
    setMenuError(null);
    setMenu("pause");
  }, [speed]);

  const startPlaying = useCallback(() => {
    setMenu(null);
    setTool(null);
    setSelected(null);
    setPanel(null);
    setHover(null);
    setSpeed(resumeSpeed.current);
  }, [setSpeed]);

  const saveTo = useCallback(
    async (slot: Slot) => {
      const { data, summary } = await save();
      const ok = writeSave(slot, { data, summary, savedAt: Date.now() });
      return ok;
    },
    [save],
  );

  const menuActions = {
    onResume: startPlaying,
    onNewGame: async () => {
      await newGame();
      resumeSpeed.current = 1;
      startPlaying();
    },
    onSave: async (slot: Slot) => {
      if (await saveTo(slot)) {
        startPlaying();
        flash(`Saved to ${slotLabel(slot)}.`);
      } else setMenuError("Couldn't save: this browser isn't letting the game use storage. Try Export instead.");
    },
    onLoad: async (slot: Slot) => {
      const stored = readSave(slot);
      if (!stored) return setMenuError(`${slotLabel(slot)} is empty.`);
      const r = await load(stored.data);
      if (r.ok) startPlaying();
      else setMenuError(r.reason);
    },
    onExport: async () => {
      const { data, summary } = await save();
      downloadSave({ data, summary, savedAt: Date.now() });
    },
    onImport: async () => {
      const text = await pickSaveFile();
      if (text === null) return;
      const r = await load(text);
      if (r.ok) startPlaying();
      else setMenuError(r.reason);
    },
  };

  // Autosave at the start of every game day.
  const lastDay = useRef<number | null>(null);
  const day = snapshot?.time.day;
  useEffect(() => {
    if (day === undefined || menu) return;
    if (lastDay.current !== null && day !== lastDay.current && settings.autosave) {
      saveTo("autosave").then((ok) => ok || flash("Autosave failed: browser storage is unavailable."));
    }
    lastDay.current = day;
  }, [day, menu, saveTo, flash, settings.autosave]);

  // Another hole: selections and undo belong to the old one.
  const holeId = snapshot?.holeId;
  useEffect(() => {
    undoStack.current = [];
    setCanUndo(false);
    setSelected(null);
  }, [holeId]);

  // A different game (new or loaded) invalidates day tracking.
  const gameId = snapshot?.gameId;
  useEffect(() => {
    lastDay.current = null;
    undoStack.current = [];
    setCanUndo(false);
    setFlags({ sawNoise: false, openedFlows: false, sawThreeD: false });
  }, [gameId]);

  // The tutorial watches for things only the UI knows about.
  useEffect(() => {
    if (overlay === "noise") setFlags((f) => (f.sawNoise ? f : { ...f, sawNoise: true }));
  }, [overlay]);
  useEffect(() => {
    if (panel === "flows") setFlags((f) => (f.openedFlows ? f : { ...f, openedFlows: true }));
  }, [panel]);
  useEffect(() => {
    if (settings.view === "3d") setFlags((f) => (f.sawThreeD ? f : { ...f, sawThreeD: true }));
  }, [settings.view]);
  const goal = snapshot && tutorialOn ? currentGoal(snapshot, flags) : null;
  const highlight = goal?.highlight ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "?" || (e.code === "Slash" && e.shiftKey)) {
        setHelpOpen((h) => !h);
        return;
      }
      if (helpOpen && e.code === "Escape") {
        setHelpOpen(false);
        return;
      }
      if (menu || helpOpen) return;
      if (e.code === "Escape") {
        // Esc backs out of whatever is open; with nothing open, it opens the menu.
        if (mapOpen) setMapOpen(false);
        else if (tool || selected !== null || panel) {
          setTool(null);
          setSelected(null);
          setPanel(null);
        } else openMenu();
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "KeyR") rotate();
      if (e.code === "KeyM") setMapOpen((m) => !m);
      // [ and ] step through the holes.
      const next = e.code === "BracketRight" || e.key === "]";
      const prev = e.code === "BracketLeft" || e.key === "[";
      if ((next || prev) && snapshot && snapshot.holes.length > 1) {
        const i = snapshot.holes.findIndex((h) => h.id === snapshot.holeId);
        const n = snapshot.holes.length;
        setActiveHole(snapshot.holes[(i + (next ? 1 : n - 1)) % n]!.id);
      }
      if (e.code === "KeyV") updateSettings({ view: settings.view === "2d" ? "3d" : "2d" });
      const letter = e.key.toUpperCase();
      if (letter === DEMOLISH_KEY) {
        setSelected(null);
        setTool((t) => (t?.kind === "demolish" ? null : { kind: "demolish" }));
      }
      const room = Object.entries(HOTKEYS).find(([, k]) => k === letter)?.[0];
      const def = room ? roomDefs.find((d) => d.id === room && d.buildable) : undefined;
      if (def) {
        setSelected(null);
        setTool((t) => (t?.kind === "build" && t.room === def.id ? null : buildTool(def)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, helpOpen, mapOpen, tool, selected, panel, openMenu, undo, rotate, settings.view, updateSettings, snapshot, setActiveHole]);

  return (
    <div
      className={`app${settings.colorBlind ? " color-blind" : ""}`}
      style={{ "--ui-scale": settings.uiScale } as React.CSSProperties}
    >
      <Hud
        snapshot={snapshot}
        speed={speed}
        setSpeed={setSpeed}
        setDrill={(active) => onCommand({ type: "setDrill", active })}
        toggleOffice={() => togglePanel("office")}
        toggleFlows={() => togglePanel("flows")}
        toggleNetwork={() => togglePanel("network")}
        view={settings.view}
        toggleView={() => updateSettings({ view: settings.view === "2d" ? "3d" : "2d" })}
        setActiveHole={setActiveHole}
        toggleMap={() => setMapOpen((m) => !m)}
        highlight={highlight}
        openMenu={openMenu}
        keysEnabled={!menu}
      />
      <ResourceBar s={snapshot} />
      <div className="main">
        <BuildPalette
          tool={tool}
          setTool={(t) => (setTool(t), setSelected(null))}
          resources={snapshot?.resources ?? {}}
          highlight={highlight}
          deposits={snapshot?.holeDeposits ?? []}
          rotate={rotate}
          canUndo={canUndo}
          undo={undo}
        />
        <div className="view">
          <OverlayPicker overlay={overlay} setOverlay={setOverlay} highlight={highlight} />
          {snapshot && tutorialOn && !menu && (
            <Tutorial
              s={snapshot}
              flags={flags}
              onHide={() => {
                setTutorialOn(false);
                setTutorialHidden(true);
              }}
            />
          )}
          <Messages s={snapshot} />
          {snapshot && mapOpen && (
            <MapScreen
              s={snapshot}
              onClose={() => setMapOpen(false)}
              site={plannedSite}
              onSite={setPlannedSite}
              onFound={async (site) => {
                const r = await found(site);
                if (r.ok) setPlannedSite(null);
                else flash(r.reason);
              }}
            />
          )}
          <ViewHost
            snapshot={snapshot}
            tool={tool}
            onHover={setHover}
            onCommand={onCommand}
            onCancel={() => setTool(null)}
            selected={selected}
            onSelect={(id) => (setSelected(id), id !== null && setPanel(null))}
            onInvalid={(reason) => (flash(reason), play("refuse"))}
            colorBlind={settings.colorBlind}
            mode={settings.view}
            quality={settings.quality3d}
            onViewError={(message) => {
              flash(message);
              updateSettings({ view: "2d" });
            }}
            overlay={overlay}
          />
        </div>
        {snapshot && officeOpen && <Office s={snapshot} onCommand={onCommand} onClose={() => setPanel(null)} />}
        {snapshot && panel === "flows" && <FlowPanel s={snapshot} onClose={() => setPanel(null)} />}
        {snapshot && panel === "network" && <NetworkPanel s={snapshot} onRoute={route} onClose={() => setPanel(null)} />}
        {snapshot && !panel && selected !== null && (
          <Inspector s={snapshot} roomId={selected} onCommand={onCommand} onClose={() => setSelected(null)} />
        )}
      </div>
      <StatusBar info={hover} snapshot={snapshot} notice={notice} overlay={overlay} />
      {menu && (
        <Menu
          mode={menu}
          {...menuActions}
          error={menuError}
          tutorialHidden={!tutorialOn}
          onShowTutorial={() => {
            setTutorialOn(true);
            setTutorialHidden(false);
            startPlaying();
          }}
          settings={settings}
          updateSettings={updateSettings}
          onHelp={() => setHelpOpen(true)}
        />
      )}
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
