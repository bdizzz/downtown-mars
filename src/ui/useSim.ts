import { useCallback, useEffect, useRef, useState } from "react";
import type { CommandResult, SimCommand } from "../sim/commands";
import type { SaveSummary } from "../sim/save";
import type { Snapshot } from "../sim/snapshot";
import type { FromWorker, RouteAction, ToWorker } from "../worker/protocol";

type Reply = Extract<FromWorker, { id: number }>;

export function useSim() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (r: Reply) => void>());
  const nextId = useRef(1);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const lastLayout = useRef<Pick<Snapshot, "layout" | "effects"> | null>(null);
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === "snapshot") {
        const { layout, effects, layoutVersion: _, ...rest } = msg.snapshot;
        if (layout && effects) lastLayout.current = { layout, effects };
        if (!lastLayout.current) return;
        // Conditions change every tick, but the layout only comes when it changes: put them back on its rooms.
        for (const r of lastLayout.current.layout.rooms) {
          const c = rest.conditions[r.id];
          if (c !== undefined) r.condition = c;
        }
        setSnapshot({ ...rest, ...lastLayout.current });
        setSpeedState(msg.speed);
      } else {
        pending.current.get(msg.id)?.(msg);
        pending.current.delete(msg.id);
      }
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const post = (msg: ToWorker) => workerRef.current?.postMessage(msg);

  /** Send a message with an id and wait for the worker's reply to it. */
  const ask = useCallback(
    <T extends Reply>(make: (id: number) => ToWorker) =>
      new Promise<T>((resolve) => {
        const id = nextId.current++;
        pending.current.set(id, (r) => resolve(r as T));
        post(make(id));
      }),
    [],
  );

  const setSpeed = useCallback((s: number) => post({ type: "setSpeed", speed: s }), []);
  const setActiveHole = useCallback((holeId: number) => post({ type: "setActiveHole", holeId }), []);

  const send = useCallback(
    async (command: SimCommand): Promise<CommandResult> =>
      (await ask<Extract<Reply, { type: "commandResult" }>>((id) => ({ type: "command", id, command }))).result,
    [ask],
  );

  const save = useCallback(
    async (): Promise<{ data: string; summary: SaveSummary }> =>
      ask<Extract<Reply, { type: "saved" }>>((id) => ({ type: "save", id })),
    [ask],
  );

  const load = useCallback(
    async (data: string): Promise<CommandResult> =>
      (await ask<Extract<Reply, { type: "loaded" }>>((id) => ({ type: "load", id, data }))).result,
    [ask],
  );

  const newGame = useCallback(
    async (): Promise<CommandResult> => (await ask<Extract<Reply, { type: "loaded" }>>((id) => ({ type: "newGame", id }))).result,
    [ask],
  );

  const found = useCallback(
    async (site: { lat: number; lon: number }): Promise<CommandResult> =>
      (await ask<Extract<Reply, { type: "commandResult" }>>((id) => ({ type: "found", id, site }))).result,
    [ask],
  );

  const route = useCallback(
    async (action: RouteAction): Promise<CommandResult> =>
      (await ask<Extract<Reply, { type: "commandResult" }>>((id) => ({ type: "route", id, action }))).result,
    [ask],
  );

  return { snapshot, speed, setSpeed, setActiveHole, send, found, route, save, load, newGame };
}
