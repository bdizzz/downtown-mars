import { useEffect, useRef } from "react";
import { play, setHum } from "../audio/sound";
import type { Snapshot } from "../sim/snapshot";

/** Turn changes in the game into sounds: drops, visitors, warnings, new floors. */
export function useSounds(s: Snapshot | null): void {
  const prev = useRef<{ gameId: number; messages: number; floors: number } | null>(null);

  useEffect(() => {
    if (!s) return;
    const lastTick = s.messages.at(-1)?.tick ?? -1;
    const p = prev.current;
    prev.current = { gameId: s.gameId, messages: lastTick, floors: s.layout.hole.floors };
    if (!p || p.gameId !== s.gameId) return; // new or loaded game: no replay of old events

    for (const m of s.messages.filter((m) => m.tick > p.messages)) {
      if (m.text.startsWith("Supply drop landed")) play("landing");
      else if (m.text.includes("waiting at the office")) play("chime");
      else if (m.kind === "warn") play("alert");
    }
    if (s.layout.hole.floors > p.floors) play("floor");
  }, [s]);

  const machines = s?.layout.rooms.filter((r) => r.type === "life_support" && !r.planned).length ?? 0;
  useEffect(() => setHum(machines), [machines]);
}
