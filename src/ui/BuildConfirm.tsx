import { RoomName } from "./RoomName";
import { useEffect } from "react";
import type { Layout } from "../sim/placement";
import { roomDef } from "../sim/rooms";
import type { PendingBuild } from "../view/types";

// Asks before placing a room over corridors: it fills them in, and may cut
// other rooms and corridors off from the shaft (outlined in red meanwhile).

export function BuildConfirm({ build, layout, onAccept, onCancel }: { build: PendingBuild; layout: Layout; onAccept: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAccept, onCancel]);

  const n = build.destroys.length;
  const cutOff = build.strands.rooms.map((id) => layout.rooms.find((r) => r.id === id)).filter((r) => !!r);
  const halls = build.strands.corridors.length;
  return (
    <div className="corridor-confirm" role="dialog" aria-label="Confirm building over corridors">
      <h3>Build over corridors?</h3>
      <p>
        Placing the {roomDef(build.room).name.toLowerCase()} here fills in {n} corridor {n === 1 ? "segment" : "segments"}.
      </p>
      {cutOff.length || halls ? (
        <p className="warn">
          That cuts off{" "}
          {[
            ...cutOff.map((r) => <RoomName key={r!.id} room={r!} />),
            ...(halls ? [<span key="halls">{`${halls} more corridor ${halls === 1 ? "segment" : "segments"}`}</span>] : []),
          ].flatMap((el, i) => (i ? [<span key={`sep${i}`}>, </span>, el] : [el]))}{" "}
          from the shaft (outlined in red).
        </p>
      ) : (
        <p className="k">Nothing else loses access.</p>
      )}
      <div className="buttons">
        <button className="primary" onClick={onAccept}>
          Build anyway <kbd>↵</kbd>
        </button>
        <button onClick={onCancel}>
          Cancel <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
