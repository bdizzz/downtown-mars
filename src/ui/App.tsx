import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { HoverInfo, Tool } from "../view/types";
import type { SimCommand } from "../sim/commands";
import { roomDef, roomDefs } from "../sim/rooms";
import { BARE_ROCK, BuildStrip, buildTool } from "./BuildPalette";
import { CORRIDOR_KEY, DEMOLISH_KEY, HOTKEYS, shapesFor } from "../view/buildCatalog";
import { ChartsStrip, Dock, MODE_KEYS, ViewStrip, type Chart, type Mode } from "./Dock";
import { corridors } from "../sim/corridors";
import { FlowPanel } from "./FlowPanel";
import { Help } from "./Help";
import { Hud } from "./Hud";
import { Inspector } from "./Inspector";
import { MapScreen, type SitePick } from "./MapScreen";
import { NetworkPanel } from "./NetworkPanel";
import { PeoplePanel } from "./PeoplePanel";
import { ConstructionPanel } from "./ConstructionPanel";
import { MaintenancePanel } from "./MaintenancePanel";
import { Menu } from "./Menu";
import { Messages } from "./Messages";
import { Office } from "./Office";
import { EventCards } from "./EventCards";
import { ViewHost } from "./ViewHost";
import { ResourceBar } from "./ResourceBar";
import { TrendsPanel } from "./TrendsPanel";
import { WhyPanel, type WhyTab } from "./WhyPanel";
import type { Spot } from "../view/reachView";
import { downloadSave, pickSaveFile, readSave, slotLabel, writeSave, type Slot } from "./saves";
import { StatusBar } from "./StatusBar";
import { Tutorial } from "./Tutorial";
import { TipCard } from "./TipCard";
import { dueTip } from "../view/tips";
import { Welcome } from "./Welcome";
import { FailureCard } from "./FailureCard";
import { nextFailureCard, type FailureCard as FailureCardData } from "../view/failure";
import {
  advanceStep,
  FOLLOW,
  metGoals,
  setTutorialHidden,
  shownGoal,
  tutorial,
  tutorialHidden,
  type TutorialStep,
  type UiFlags,
} from "./tutorialGoals";
import { play, setAudioSettings, unlockAudio } from "../audio/sound";
import { applySystemBar, canHideSystemBar } from "./systemBar";
import { useSettings } from "./settings";
import { installConsole } from "./devConsole";
import { FloorPicker, shownFloor } from "./FloorPicker";
import { CorridorConfirm } from "./CorridorConfirm";
import type { PendingBuild, Proposal } from "../view/types";
import { refitCommand } from "../view/interaction";
import { BuildConfirm } from "./BuildConfirm";
import { useSim } from "./useSim";
import { useSounds } from "./useSounds";
import { bootStep } from "./boot";
import { UpdateBanner } from "./UpdateBanner";
import { presetOf } from "../view/graphics";

const NOTICE_MS = 3000;
/** How deep the showcase behind the title is dug, for a player with no autosave (only its first floor shows). */
const TITLE_SHOWCASE_FLOORS = 2;

export function App() {
  const { snapshot, speed, setSpeed, setActiveHole, send, found, route, save, load, newGame, advance } = useSim();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  /** A room waiting on the player's say-so because it would fill in corridors. */
  const [pendingBuild, setPendingBuild] = useState<PendingBuild | null>(null);
  // Walking around in first person: sightseeing, not building.
  const [walking, setWalking] = useState(false);
  // Mouse look in first person: the pointer can't reach the floor picker, so it steps aside until the mouse is let go.
  const [mouseLook, setMouseLook] = useState(false);
  // The mode open at the bottom (Build, View, Map or Charts), or none.
  const [mode, setModeState] = useState<Mode | null>(null);
  useEffect(() => {
    if (walking) {
      setTool(null);
      setModeState((m) => (m === "build" ? null : m));
    }
  }, [walking]);
  // What building over corridors would cost, outlined in the view. Kept stable between
  // renders: a fresh object each time would re-send it to the view on every hover.
  const buildWarning = useMemo(
    () => (pendingBuild ? { edges: [...pendingBuild.destroys, ...pendingBuild.strands.corridors], rooms: pendingBuild.strands.rooms } : null),
    [pendingBuild],
  );
  /** A snaked corridor chain waiting for the player to confirm. */
  const [proposal, setProposal] = useState<Proposal | null>(null);
  /** The floor the plan and 3D views focus on; null shows every floor in 3D. */
  const [viewFloor, setViewFloor] = useState<number | null>(null);
  /** A floor shown while the pointer is on its button in the floor picker (undefined: none). */
  const [previewFloor, setPreviewFloor] = useState<number | null | undefined>(undefined);
  /**
   * What the view shows: the floor being previewed, else the one picked. Walking in
   * first person there's no preview: picking a floor only moves you there.
   */
  const lookFloor = previewFloor !== undefined && !walking ? previewFloor : viewFloor;
  // The right-hand panel: the office or the flow diagram; the room inspector shows when neither is open.
  const [panel, setPanel] = useState<"office" | "why" | "flows" | "network" | "people" | "construction" | "maintenance" | "trends" | null>(null);
  const officeOpen = panel === "office";
  /** The series Trends opens on (a resource clicked in the bar at the top). */
  const [trendKey, setTrendKey] = useState("happiness");
  /** Phones: the top bar's drop-down (speeds, needs, resources) is open. Only its toggle closes it. */
  const [hudOpen, setHudOpen] = useState(false);
  const togglePanel = (p: "office" | "flows" | "network" | "people" | "construction" | "maintenance" | "trends") => {
    setPanel((cur) => (cur === p ? null : p));
    setSelected(null);
  };
  const chart: Chart | null = panel && panel !== "office" && panel !== "why" ? panel : null;
  /** The "Why?" panel's tab, and what its Show me lights up (F-018). */
  const [whyTab, setWhyTab] = useState<WhyTab>("health");
  const [spotlight, setSpotlight] = useState<{ id: string; spot: Spot } | null>(null);
  // Show me lasts while the "Why?" panel (or the office, for a visit about a cause) is open; a tip's lasts until it's read.
  useEffect(() => {
    if (panel !== "why" && panel !== "office") setSpotlight((cur) => (cur?.id.startsWith("tip:") ? cur : null));
  }, [panel]);
  /**
   * Open a mode (or close it, with null). Only Build places things, so
   * leaving it drops the tool in hand; the charts' panels belong to Charts.
   */
  const setMode = useCallback((m: Mode | null) => {
    setModeState(m);
    if (m !== "build") {
      setTool(null);
      setProposal(null);
    }
    if (m !== "charts") setPanel((p) => (p === "office" || p === "why" ? p : null));
  }, []);
  /** Pick up a build tool, opening Build mode if it isn't (a room's key works from any mode). */
  const takeTool = useCallback(
    (t: Tool | ((cur: Tool) => Tool)) => {
      setMode("build");
      setSelected(null);
      setTool(t);
    },
    [setMode],
  );
  // "title" until the player starts or continues a game; then the pause menu opens over play.
  const [menu, setMenu] = useState<"title" | "pause" | null>("title");
  const [menuError, setMenuError] = useState<string | null>(null);
  /** The card a new game opens with (ui/Welcome.tsx); the game waits behind it. */
  const [welcome, setWelcome] = useState(false);
  /** A hole has failed (ui/FailureCard.tsx, T-162); the game waits behind the card. */
  const [failure, setFailure] = useState<FailureCardData | null>(null);
  /** Failed holes whose card has been shown (or that had failed before the game loaded), per game. */
  const seenFailed = useRef<{ gameId: number; ids: Set<number>; over: boolean }>({ gameId: -1, ids: new Set(), over: false });
  const resumeSpeed = useRef(1);
  const [tutorialOn, setTutorialOn] = useState(() => !tutorialHidden());
  const [flags, setFlags] = useState<UiFlags>({ sawNoise: false, openedFlows: false, sawThreeD: false });
  const [settings, updateSettings] = useSettings();
  /**
   * The cutaway always shows the whole hole, from the surface down, with no floor picker. The picked
   * floor is kept as it was, so leaving the cutaway goes back to it.
   */
  const cutaway = settings.view === "3d" && settings.view3d.camera === "cutaway" && !walking;
  useEffect(() => {
    if (cutaway) setPreviewFloor(undefined);
  }, [cutaway]);
  const [helpOpen, setHelpOpen] = useState(false);
  const mapOpen = mode === "map";

  // Behind the title (T-090): its first floor, the camera drifting round it. Your own hole, from the
  // autosave, or else a showcase colony (sim/showcase.ts) built into the fresh game the sim starts
  // with, which New game replaces. Phones, low graphics and the flat views get a painted still
  // instead. The loading screen waits for the hole to arrive.
  const titling = menu === "title";
  const [sceneLoaded, setSceneLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    // A failed game's autosave can't be loaded (T-162), so it gets the showcase too.
    const auto = readSave("autosave");
    const showcase = () => send({ type: "consoleShowcase", floors: TITLE_SHOWCASE_FLOORS });
    void (auto && !auto.summary.failed ? load(auto.data).then((r) => (r.ok ? r : showcase())) : showcase()).then(() => live && setSceneLoaded(true));
    return () => {
      live = false;
    };
  }, [load, send]);
  useEffect(() => {
    if (sceneLoaded && snapshot) bootStep("world");
  }, [sceneLoaded, snapshot]);
  const titleStill = settings.view !== "3d" || presetOf(settings.graphics) === "low" || matchMedia("(pointer: coarse) and (max-width: 760px)").matches;
  // The title always looks on from Free view, whichever camera you play with. Kept stable, or the view would be re-sent it every render.
  const titleView3d = useMemo(() => ({ ...settings.view3d, camera: "iso" as const }), [settings.view3d]);
  const [plannedSite, setPlannedSite] = useState<SitePick | null>(null);

  // Testing helpers in the browser console (dm.help()).
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;
  useEffect(() => installConsole({ send, advance, snapshot: () => latestSnapshot.current }), [send, advance]);

  useSounds(snapshot);
  useEffect(() => setAudioSettings(settings), [settings]);
  // The installed app's system bar: full screen needs a tap, so it's asked for when the
  // setting changes (a tap on the switch) and on any tap while it's on but not yet hidden
  // (the first after launch, or after the phone's back gesture left full screen).
  useEffect(() => {
    applySystemBar(settings.fullscreen);
    if (!settings.fullscreen || !canHideSystemBar()) return;
    const onTap = () => applySystemBar(true);
    window.addEventListener("pointerup", onTap);
    return () => window.removeEventListener("pointerup", onTap);
  }, [settings.fullscreen]);
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

  // Free view with every floor showing looks at the surface; picking up something to build
  // underground (a room below ground, or corridors) drops the view to floor 1.
  useEffect(() => {
    const below = tool?.kind === "corridor" || (tool?.kind === "build" && roomDef(tool.room).size !== "surface");
    if (below && viewFloor === null && settings.view === "3d" && settings.view3d.camera === "iso") setViewFloor(1);
  }, [tool, viewFloor, settings.view, settings.view3d.camera]);

  // The lining rooms are built in (T-038): bare rock each time Build opens, then kept while placing room after room.
  const [lining, setLining] = useState(BARE_ROCK);
  useEffect(() => {
    if (mode === "build") setLining(BARE_ROCK);
  }, [mode]);
  /** The tool as the views use it: a room in hand carries the lining it'll be built in. */
  const placing = useMemo<Tool>(() => (tool?.kind === "build" && lining !== BARE_ROCK ? { ...tool, lining } : tool), [tool, lining]);

  // The corridor tool remembers its finish between uses.
  const [lastFinish, setLastFinish] = useState(corridors.defaultFinish);
  useEffect(() => {
    if (tool?.kind === "corridor") setLastFinish(tool.finish);
  }, [tool]);

  const rotate = useCallback(() => {
    setTool((t) => {
      if (t?.kind !== "build") return t;
      const shapes = shapesFor(roomDef(t.room));
      const i = shapes.findIndex(([w, d]) => w === t.shape[0] && d === t.shape[1]);
      return { ...t, shape: shapes[(i + 1) % shapes.length]! };
    });
  }, []);

  // The sim stays paused behind any menu, and the welcome and failure cards.
  useEffect(() => {
    if (menu || welcome || failure) setSpeed(0);
  }, [menu, welcome, failure, setSpeed]);

  const openMenu = useCallback(() => {
    resumeSpeed.current = speed || resumeSpeed.current;
    setMenuError(null);
    setMenu("pause");
  }, [speed]);

  const startPlaying = useCallback((paused = false) => {
    setMenu(null);
    setModeState((m) => (m === "build" || m === "map" ? null : m));
    setTool(null);
    setSelected(null);
    setPanel(null);
    setHover(null);
    if (!paused) setSpeed(resumeSpeed.current);
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
    onResume: () => startPlaying(),
    onNewGame: async () => {
      await newGame();
      resumeSpeed.current = 1;
      setWelcome(true);
      startPlaying(true);
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
      // A loaded game starts paused (T-146); play resumes at the speed you had.
      if (r.ok) startPlaying(true);
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
      if (r.ok) startPlaying(true);
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

  // A hole has failed (T-162): its card, once. When every hole has, the game is over: the save is
  // kept, marked failed, and the card leads back to the start screen.
  useEffect(() => {
    if (!snapshot) return;
    const seen = seenFailed.current;
    if (seen.gameId !== snapshot.gameId) {
      seenFailed.current = { gameId: snapshot.gameId, ids: new Set(snapshot.holes.filter((h) => h.failed).map((h) => h.id)), over: false };
      return;
    }
    // Once per game: a new game's first snapshot can come after the menu closes on the old one.
    if (failure || menu || seen.over) return;
    const card = nextFailureCard(snapshot.holes, snapshot.gameOver, seen.ids);
    if (!card) return;
    if (card.holeId !== null) seen.ids.add(card.holeId);
    if (card.kind === "over") seen.over = true;
    resumeSpeed.current = speed || resumeSpeed.current;
    setFailure(card);
    if (card.kind === "over" && settings.autosave) {
      saveTo("autosave").then((ok) => ok || flash("Autosave failed: browser storage is unavailable."));
    }
  }, [snapshot, failure, menu, speed, saveTo, flash, settings.autosave]);

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
  // The step the tutorial's card is on (the arrows and dots pick one), moved on when its goal is met.
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(FOLLOW);
  const met = snapshot ? metGoals(snapshot, flags) : null;
  const step = met ? advanceStep(tutorialStep, met) : tutorialStep;
  if (step !== tutorialStep) setTutorialStep(step);
  const shown = met && tutorialOn ? shownGoal(step, met) : -1;
  const highlight = shown >= 0 && !met![shown] ? tutorial.goals[shown]!.highlight : null;
  /** The deputy's one-time tip, when a problem first shows up (F-018); it covers the tutorial's card while it's up. */
  const tip = snapshot && settings.tips ? dueTip(snapshot) : null;
  // A tip's Show me goes with it, if its problem goes first.
  useEffect(() => {
    if (spotlight?.id.startsWith("tip:") && spotlight.id !== `tip:${tip?.id}`) setSpotlight(null);
  }, [spotlight, tip?.id]);

  // Floors the plan and 3D views can focus on: every dug floor, plus the one being dug.
  const floorCount = snapshot ? (snapshot.drill.floor ?? snapshot.layout.hole.floors) : 1;
  const stepFloor = useCallback(
    (d: number) =>
      setViewFloor((f) => {
        const cur = shownFloor(f, floorCount, settings.view === "plan");
        if (cur === null) return d > 0 ? 1 : null;
        const next = cur + d;
        if (next < 1) return settings.view === "3d" ? null : 1;
        return Math.min(floorCount, next);
      }),
    [floorCount, settings.view],
  );

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
      if (menu || helpOpen || welcome) return;
      if (e.code === "Escape") {
        // Esc backs out of whatever is open, one step at a time; with nothing open, it opens the menu.
        if (mapOpen) setMode(null);
        else if (tool) setTool(null);
        else if (selected !== null || panel) {
          setSelected(null);
          setPanel(null);
        } else if (mode) setMode(null);
        else openMenu();
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // The modes' keys work anywhere: V, C and M open (or close) View, Charts and Map;
      // B opens Build (inside Build, B is the battery bank's key).
      const toggle = (m: Mode) => setMode(mode === m ? null : m);
      if (e.code === MODE_KEYS.view) return toggle("view");
      if (e.code === MODE_KEYS.charts) return toggle("charts");
      if (e.code === MODE_KEYS.map) return toggle("map");
      if (e.code === MODE_KEYS.build && mode !== "build") {
        if (!walking) setMode("build");
        return;
      }
      // [ and ] step through the holes.
      const next = e.code === "BracketRight" || e.key === "]";
      const prev = e.code === "BracketLeft" || e.key === "[";
      if ((next || prev) && snapshot && snapshot.holes.length > 1) {
        const i = snapshot.holes.findIndex((h) => h.id === snapshot.holeId);
        const n = snapshot.holes.length;
        setActiveHole(snapshot.holes[(i + (next ? 1 : n - 1)) % n]!.id);
      }
      // Page Up / Page Down, or the up and down arrows, step through floors in the plan and 3D views
      // (up is toward the surface). Walking, the arrows walk: the 3D view takes them first.
      const floorKey = { PageUp: -1, PageDown: 1, ArrowUp: -1, ArrowDown: 1 }[e.code];
      if (floorKey && snapshot && settings.view !== "2d" && !cutaway) {
        e.preventDefault();
        stepFloor(floorKey);
      }
      // Everything else is Build's: its tools and rooms answer to their keys only there.
      if (mode !== "build" || walking) return;
      if (e.code === "KeyR") rotate();
      const letter = e.key.toUpperCase();
      if (letter === CORRIDOR_KEY) takeTool((t) => (t?.kind === "corridor" ? null : { kind: "corridor", finish: lastFinish, erase: false }));
      if (letter === DEMOLISH_KEY) takeTool((t) => (t?.kind === "demolish" ? null : { kind: "demolish" }));
      const room = Object.entries(HOTKEYS).find(([, k]) => k === letter)?.[0];
      const def = room ? roomDefs.find((d) => d.id === room && d.buildable) : undefined;
      if (def) takeTool((t) => (t?.kind === "build" && t.room === def.id ? null : buildTool(def)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, helpOpen, welcome, mapOpen, mode, setMode, takeTool, tool, selected, panel, openMenu, undo, rotate, settings.view, updateSettings, snapshot, setActiveHole, stepFloor, lastFinish, walking, cutaway]);

  /** Charts → Trends on a series. */
  const showTrend = (key: string) => {
    setTrendKey(key);
    setMode("charts");
    setPanel("trends");
    setSelected(null);
  };
  /** From a cell of the resource grid, or the "needs you" slot: Health and Happiness open the "Why?" panel (F-018), the rest Trends. */
  const openTrend = (key: string) => {
    if (key !== "health" && key !== "happiness") return showTrend(key);
    setWhyTab(key);
    setPanel("why");
    setSelected(null);
  };
  /** Show me: light up the rooms and homes, and bring the focus's floor into view. */
  const showMe = (id: string | null, spot: Spot | null) => {
    setSpotlight(id && spot ? { id, spot } : null);
    const room = spot && snapshot?.layout.rooms.find((r) => r.id === spot.focus);
    if (room?.at.kind === "ring" && settings.view !== "2d" && !walking) setViewFloor(room.at.floor);
  };

  return (
    <div
      className={`app${settings.colorBlind ? " color-blind" : ""}${welcome ? " welcoming" : ""}${titling ? " titling" : ""}${hudOpen ? " hud-open" : ""}`}
      style={{ "--ui-scale": settings.uiScale } as React.CSSProperties}
    >
      {/* Build mode: a thin yellow frame round the screen, so it's always clear you're building. Clicks go through it. */}
      {mode === "build" && <div className="build-frame" aria-hidden="true" />}
      <Hud
        snapshot={snapshot}
        speed={speed}
        setSpeed={setSpeed}
        setDrill={(active) => onCommand({ type: "setDrill", active })}
        toggleOffice={() => togglePanel("office")}
        setActiveHole={setActiveHole}
        highlight={highlight}
        openMenu={openMenu}
        openTrend={openTrend}
        keysEnabled={!menu}
        open={hudOpen}
        setOpen={setHudOpen}
      />
      <ResourceBar s={snapshot} onTrend={openTrend} />
      <div className="main">
        <div className="view">
          {snapshot && (
            <Dock mode={mode} setMode={setMode} walking={walking} highlight={highlight} jobs={snapshot.construction.jobs.length}>
              {mode === "build" && (
                <BuildStrip
                  tool={tool}
                  lining={lining}
                  setLining={setLining}
                  lastFinish={lastFinish}
                  setTool={(t) => (setTool(t), setSelected(null))}
                  resources={snapshot.resources}
                  highlight={highlight}
                  deposits={snapshot.holeGates}
                  rotate={rotate}
                  canUndo={canUndo}
                  undo={undo}
                  dome={snapshot.layout.domed ? "built" : snapshot.construction.jobs.some((j) => j.kind === "dome") ? "building" : "none"}
                  onBuildDome={() => onCommand({ type: "buildDome" })}
                />
              )}
              {mode === "view" && (
                <ViewStrip
                  view={settings.view}
                  setView={(view) => updateSettings({ view })}
                  view3d={settings.view3d}
                  setView3d={(view3d) => updateSettings({ view3d })}
                  overlay={overlay}
                  setOverlay={setOverlay}
                  highlight={highlight}
                />
              )}
              {mode === "charts" && <ChartsStrip s={snapshot} chart={chart} toggle={togglePanel} highlight={highlight} />}
            </Dock>
          )}
          {snapshot && tip && !menu && !welcome && (
            <div style={{ display: walking ? "none" : "contents" }}>
              <TipCard
                s={snapshot}
                tip={tip}
                shown={spotlight?.id === `tip:${tip.id}`}
                onShow={showMe}
                onSeen={() => {
                  if (spotlight?.id === `tip:${tip.id}`) setSpotlight(null);
                  onCommand({ type: "seeTip", id: tip.id });
                }}
                onOff={() => {
                  if (spotlight?.id === `tip:${tip.id}`) setSpotlight(null);
                  updateSettings({ tips: false });
                }}
              />
            </div>
          )}
          {snapshot && !tip && tutorialOn && !menu && !welcome && (
            // Out of the way in first person, but kept (folded or open, on the same step) for when you're back.
            <div style={{ display: walking ? "none" : "contents" }}>
              <Tutorial
                s={snapshot}
                met={met!}
                step={step}
                onStep={setTutorialStep}
                onHide={() => {
                  setTutorialOn(false);
                  setTutorialHidden(true);
                }}
              />
            </div>
          )}
          <Messages s={snapshot} />
          <EventCards s={snapshot} onCommand={onCommand} />
          {snapshot && mapOpen && (
            <MapScreen
              s={snapshot}
              onClose={() => setMode(null)}
              site={plannedSite}
              onSite={setPlannedSite}
              onFound={async (site) => {
                const r = await found(site);
                if (r.ok) setPlannedSite(null);
                else flash(r.reason);
              }}
            />
          )}
          {snapshot && settings.view !== "2d" && !mapOpen && !cutaway && !mouseLook && (
            <FloorPicker
              floors={floorCount}
              floor={shownFloor(viewFloor, floorCount, settings.view === "plan")}
              allowAll={settings.view === "3d" && !walking}
              onPick={setViewFloor}
              preview={walking ? undefined : previewFloor}
              onPreview={walking || !settings.floorHoverPreview ? () => {} : setPreviewFloor}
            />
          )}
          {snapshot && proposal && (
            <CorridorConfirm
              proposal={proposal}
              layout={snapshot.layout}
              resources={snapshot.resources}
              finish={lastFinish}
              onAccept={() => {
                const cmd: SimCommand = proposal.refit
                  ? refitCommand(proposal.edges, proposal.refit)
                  : proposal.erase
                  ? { type: "removeCorridors", edges: proposal.edges, all: true }
                  : { type: "drawCorridors", edges: proposal.edges, finish: lastFinish, all: true };
                onCommand(cmd);
                setProposal(null);
              }}
              onCancel={() => setProposal(null)}
            />
          )}
          {snapshot && pendingBuild && (
            <BuildConfirm
              build={pendingBuild}
              layout={snapshot.layout}
              onAccept={() => {
                const { room, at, material, finish } = pendingBuild;
                onCommand({ type: "build", room, at, confirmed: true, ...(material ? { material, finish } : {}) });
                setPendingBuild(null);
              }}
              onCancel={() => setPendingBuild(null)}
            />
          )}
          <ViewHost
            onWalking={setWalking}
            onMouseLook={setMouseLook}
            warning={buildWarning}
            onConfirmBuild={setPendingBuild}
            proposal={proposal}
            onPropose={setProposal}
            floor={titling && !titleStill ? 1 : cutaway ? null : shownFloor(lookFloor, floorCount, settings.view === "plan")}
            snapshot={snapshot}
            tool={placing}
            onHover={setHover}
            onCommand={onCommand}
            onCancel={() => setTool(null)}
            selected={selected}
            onSelect={(id) => (setSelected(id), id !== null && setPanel(null))}
            onInvalid={(reason) => (flash(reason), play("refuse"))}
            colorBlind={settings.colorBlind}
            mode={settings.view}
            graphics={settings.graphics}
            view3d={titling && !titleStill ? titleView3d : settings.view3d}
            showcase={titling && !titleStill}
            lookSpeed={settings.lookSpeed}
            onCutAngle={(cutAngle) => updateSettings({ view3d: { ...settings.view3d, cutAngle } })}
            building={mode === "build"}
            onViewError={(message) => {
              flash(message);
              updateSettings({ view: "2d" });
            }}
            overlay={overlay}
            spotlight={spotlight?.spot ?? null}
          />
        </div>
        {snapshot && officeOpen && <Office s={snapshot} onCommand={onCommand} shown={spotlight?.id ?? null} onShow={showMe} onClose={() => setPanel(null)} />}
        {snapshot && panel === "why" && (
          <WhyPanel
            s={snapshot}
            tab={whyTab}
            setTab={setWhyTab}
            shown={spotlight?.id ?? null}
            onShow={showMe}
            onSelect={(id) => (setSelected(id), setPanel(null))}
            onTrend={showTrend}
            onClose={() => setPanel(null)}
          />
        )}
        {snapshot && panel === "flows" && <FlowPanel s={snapshot} onClose={() => setPanel(null)} />}
        {snapshot && panel === "people" && <PeoplePanel s={snapshot} onClose={() => setPanel(null)} />}
        {snapshot && panel === "trends" && <TrendsPanel key={trendKey} s={snapshot} initial={trendKey} onClose={() => setPanel(null)} />}
        {snapshot && panel === "maintenance" && (
          <MaintenancePanel s={snapshot} onSelect={(id) => (setSelected(id), setPanel(null))} onClose={() => setPanel(null)} />
        )}
        {snapshot && panel === "construction" && (
          <ConstructionPanel s={snapshot} onCommand={onCommand} onSelect={(id) => (setSelected(id), setPanel(null))} onClose={() => setPanel(null)} />
        )}
        {snapshot && panel === "network" && <NetworkPanel s={snapshot} onRoute={route} onClose={() => setPanel(null)} />}
        {snapshot && !panel && selected !== null && (
          <Inspector s={snapshot} finish={lastFinish} roomId={selected} onCommand={onCommand} onClose={() => setSelected(null)} />
        )}
      </div>
      <StatusBar info={hover} snapshot={snapshot} notice={notice} overlay={overlay} view={settings.view} tool={placing} />
      {menu && (
        <Menu
          mode={menu}
          still={titleStill}
          {...menuActions}
          error={menuError}
          tutorial={tutorialOn}
          onTutorial={(on) => {
            setTutorialOn(on);
            setTutorialHidden(!on);
          }}
          settings={settings}
          updateSettings={updateSettings}
          onHelp={() => setHelpOpen(true)}
          covered={helpOpen}
          onQuitToTitle={() => setMenu("title")}
        />
      )}
      {welcome && (
        <Welcome
          onClose={() => {
            setWelcome(false);
            setSpeed(resumeSpeed.current);
          }}
        />
      )}
      {failure && (
        <FailureCard
          card={failure}
          onClose={() => {
            setFailure(null);
            if (failure.kind === "over") setMenu("title");
            else setSpeed(resumeSpeed.current);
          }}
        />
      )}
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
      <UpdateBanner saveFirst={titling ? null : () => saveTo("autosave")} />
    </div>
  );
}
