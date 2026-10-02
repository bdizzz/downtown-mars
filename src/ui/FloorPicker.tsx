// A strip of floors down the side of the plan and 3D views. Picking a floor
// shows that floor alone (plan) or hides everything above it (3D), for a
// clear look from above. "All" (3D only) shows the whole hole again.
// Pointing at a floor previews it; clicking keeps it; moving off the strip
// goes back to the floor that was kept.

interface Props {
  /** Floors there are to show: dug floors, plus the one being dug. */
  floors: number;
  floor: number | null;
  allowAll: boolean;
  onPick: (floor: number | null) => void;
  /** Show a floor for as long as the pointer is on its button (undefined: stop previewing). */
  onPreview: (floor: number | null | undefined) => void;
  /** The floor being previewed, if any. */
  preview: number | null | undefined;
}

export function FloorPicker({ floors, floor, allowAll, onPick, onPreview, preview }: Props) {
  const list = Array.from({ length: floors }, (_, i) => i + 1);
  const button = (f: number | null, label: string, title: string) => (
    <button
      key={f ?? "all"}
      className={`${floor === f ? "on" : ""}${preview === f && floor !== f ? " preview" : ""}`}
      onMouseEnter={() => onPreview(f)}
      onClick={() => {
        onPick(f);
        onPreview(undefined);
      }}
      title={title}
    >
      {label}
    </button>
  );
  return (
    <div className="floor-picker" role="group" aria-label="Floor" onMouseLeave={() => onPreview(undefined)}>
      {allowAll && button(null, "All", "Show every floor")}
      {list.map((f) => button(f, `F${f}`, `Floor ${f} (↑ ↓ or Page Up / Page Down)`))}
    </div>
  );
}

/** The floor the view shows, clamped to what exists; the plan view always shows one. */
export function shownFloor(floor: number | null, floors: number, plan: boolean): number | null {
  if (floor === null) return plan ? 1 : null;
  return Math.min(Math.max(1, floor), floors);
}
