// A strip of floors down the side of the plan and 3D views. Picking a floor
// shows that floor alone (plan) or hides everything above it (3D), for a
// clear look from above. "All" (3D only) shows the whole hole again.

interface Props {
  /** Floors there are to show: dug floors, plus the one being dug. */
  floors: number;
  floor: number | null;
  allowAll: boolean;
  onPick: (floor: number | null) => void;
}

export function FloorPicker({ floors, floor, allowAll, onPick }: Props) {
  const list = Array.from({ length: floors }, (_, i) => i + 1);
  return (
    <div className="floor-picker" role="group" aria-label="Floor">
      {allowAll && (
        <button className={floor === null ? "on" : ""} onClick={() => onPick(null)} title="Show every floor">
          All
        </button>
      )}
      {list.map((f) => (
        <button key={f} className={floor === f ? "on" : ""} onClick={() => onPick(f)} title={`Floor ${f} (Page Up / Page Down)`}>
          F{f}
        </button>
      ))}
    </div>
  );
}

/** The floor the view shows, clamped to what exists; the plan view always shows one. */
export function shownFloor(floor: number | null, floors: number, plan: boolean): number | null {
  if (floor === null) return plan ? 1 : null;
  return Math.min(Math.max(1, floor), floors);
}
