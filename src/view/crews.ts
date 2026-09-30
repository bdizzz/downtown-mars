import type { Snapshot } from "../sim/snapshot";

// Which rooms a maintenance or cleaning crew is working on right now, and the
// icon each view shows on them.

export const CREW_ICON = { all: "🛠", cleanable: "🧽" } as const;

/** Rooms being worked on, by id: the crew's icon. */
export function crewsAt(s: Pick<Snapshot, "maintenance">): Map<number, string> {
  return new Map(s.maintenance.lanes.filter((l) => l.target !== null).map((l) => [l.target!, CREW_ICON[l.kind]]));
}

/** A key that changes when any crew moves on to another room. */
export function crewsKey(crews: Map<number, string>): string {
  return [...crews].map(([id, icon]) => `${id}${icon}`).join(",");
}
