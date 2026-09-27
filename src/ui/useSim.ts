import { useCallback, useEffect, useRef, useState } from "react";
import type { CommandResult, SimCommand } from "../sim/commands";
import type { Snapshot } from "../sim/snapshot";
import type { FromWorker, ToWorker } from "../worker/protocol";

export function useSim() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (r: CommandResult) => void>());
  const nextId = useRef(1);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === "snapshot") {
        setSnapshot(msg.snapshot);
        setSpeedState(msg.speed);
      } else if (msg.type === "commandResult") {
        pending.current.get(msg.id)?.(msg.result);
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

  const setSpeed = useCallback((s: number) => post({ type: "setSpeed", speed: s }), []);

  const send = useCallback(
    (command: SimCommand) =>
      new Promise<CommandResult>((resolve) => {
        const id = nextId.current++;
        pending.current.set(id, resolve);
        post({ type: "command", id, command });
      }),
    [],
  );

  return { snapshot, speed, setSpeed, send };
}
