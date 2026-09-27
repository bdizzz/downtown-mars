import { useCallback, useEffect, useRef, useState } from "react";
import type { HoverInfo, Tool } from "../render2d/stage";
import type { SimCommand } from "../sim/commands";
import { roomDef, roomDefs } from "../sim/rooms";
import { BuildPalette, buildTool, DEMOLISH_KEY, HOTKEYS, shapesFor } from "./BuildPalette";
import { Hud } from "./Hud";
import { Inspector } from "./Inspector";
import { Menu } from "./Menu";
import { Messages } from "./Messages";
import { Office } from "./Office";
import { OverlayPicker } from "./OverlayPicker";
import { PixiView } from "./PixiView";
import { ResourceBar } from "./ResourceBar";
import { downloadSave, pickSaveFile, readSave, slotLabel, writeSave, type Slot } from "./saves";
import { StatusBar } from "./StatusBar";
import { useSim } from "./useSim";

const NOTICE_MS = 3000;

export function App() {
  const { snapshot, speed, setSpeed, send, save, load, newGame } = useSim();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  // "title" until the player starts or continues a game; then the pause menu opens over play.
  const [menu, setMenu] = useState<"title" | "pause" | null>("title");
  const [menuError, setMenuError] = useState<string | null>(null);
  const resumeSpeed = useRef(1);
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
        if (!quiet) flash(result.reason);
      } else if (result.roomId !== undefined) {
        undoStack.current.push(result.roomId);
        setCanUndo(true);
      }
    },
    [send, flash],
  );

  const undo = useCallback(async () => {
    const roomId = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (roomId === undefined) return;
    const result = await send({ type: "undoBuild", roomId });
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
    setOfficeOpen(false);
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
    if (lastDay.current !== null && day !== lastDay.current) {
      saveTo("autosave").then((ok) => ok || flash("Autosave failed: browser storage is unavailable."));
    }
    lastDay.current = day;
  }, [day, menu, saveTo, flash]);

  // A different game (new or loaded) invalidates day tracking.
  const gameId = snapshot?.gameId;
  useEffect(() => {
    lastDay.current = null;
    undoStack.current = [];
    setCanUndo(false);
  }, [gameId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.code === "Escape") {
        // Esc backs out of whatever is open; with nothing open, it opens the menu.
        if (tool || selected !== null || officeOpen) {
          setTool(null);
          setSelected(null);
          setOfficeOpen(false);
        } else openMenu();
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "KeyR") rotate();
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
  }, [menu, tool, selected, officeOpen, openMenu, undo, rotate]);

  return (
    <div className="app">
      <Hud
        snapshot={snapshot}
        speed={speed}
        setSpeed={setSpeed}
        setDrill={(active) => onCommand({ type: "setDrill", active })}
        toggleOffice={() => (setOfficeOpen((o) => !o), setSelected(null))}
        openMenu={openMenu}
        keysEnabled={!menu}
      />
      <ResourceBar s={snapshot} />
      <div className="main">
        <BuildPalette
          tool={tool}
          setTool={(t) => (setTool(t), setSelected(null))}
          resources={snapshot?.resources ?? {}}
          rotate={rotate}
          canUndo={canUndo}
          undo={undo}
        />
        <div className="view">
          <OverlayPicker overlay={overlay} setOverlay={setOverlay} />
          <Messages s={snapshot} />
          <PixiView
            snapshot={snapshot}
            tool={tool}
            onHover={setHover}
            onCommand={onCommand}
            onCancel={() => setTool(null)}
            selected={selected}
            onSelect={(id) => (setSelected(id), id !== null && setOfficeOpen(false))}
            overlay={overlay}
          />
        </div>
        {snapshot && officeOpen && <Office s={snapshot} onCommand={onCommand} onClose={() => setOfficeOpen(false)} />}
        {snapshot && !officeOpen && selected !== null && (
          <Inspector s={snapshot} roomId={selected} onCommand={onCommand} onClose={() => setSelected(null)} />
        )}
      </div>
      <StatusBar info={hover} snapshot={snapshot} notice={notice} overlay={overlay} />
      {menu && <Menu mode={menu} {...menuActions} error={menuError} />}
    </div>
  );
}
