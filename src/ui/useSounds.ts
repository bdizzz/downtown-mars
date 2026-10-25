import { useEffect, useRef } from "react";
import { cue, happeningsSince, heard, humMachines, type Heard } from "../audio/cues";
import { setHum } from "../audio/sound";
import type { Snapshot } from "../sim/snapshot";

/** Turn changes in the game into sounds (data/sounds.json): drops, visitors, warnings, new floors. */
export function useSounds(s: Snapshot | null): void {
  const prev = useRef<Heard | null>(null);

  useEffect(() => {
    if (!s) return;
    const before = prev.current;
    prev.current = heard(s);
    for (const h of happeningsSince(before, s)) cue(h);
  }, [s]);

  const machines = humMachines(s);
  useEffect(() => setHum(machines), [machines]);
}
