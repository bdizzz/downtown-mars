import type { RoomInstance } from "../sim/placement";
import { roomFloor, roomName } from "../sim/roomName";
import type { Snapshot } from "../sim/snapshot";

// A room's name as the UI shows it in menus and text: its name, and a small
// coloured badge with its floor ("F3"), or "S" on the surface. (The map
// views show the floor for themselves, so they use the bare name.)

/** Each floor's badge colour, round a wheel so neighbours differ. */
export function floorColor(floor: number | null): string {
  if (floor === null) return "#8a7a6c";
  const hue = (floor * 47) % 360;
  return `hsl(${hue} 45% 42%)`;
}

export function FloorBadge({ floor }: { floor: number | null }) {
  return (
    <span className="floor-badge" style={{ background: floorColor(floor) }} title={floor === null ? "On the surface" : `Floor ${floor}`}>
      {floor === null ? "S" : `F${floor}`}
    </span>
  );
}

/** A room's name with its floor badge. */
export function RoomName({ room }: { room: RoomInstance }) {
  return (
    <span className="room-name">
      {roomName(room)}
      <FloorBadge floor={roomFloor(room)} />
    </span>
  );
}

const TOKEN = /\[\[room:(\d+)\|([^|\]]*)\|([^\]]*)\]\]/g;

/**
 * Text from the sim, with any rooms it names ("[[room:12|Galley|1]]") shown
 * as their names with floor badges: as the room's called now, or as it was
 * when it's gone.
 */
export function RichText({ text, s }: { text: string; s: Pick<Snapshot, "layout"> | null }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const room = s?.layout.rooms.find((r) => r.id === Number(m[1]));
    parts.push(
      room ? (
        <RoomName key={m.index} room={room} />
      ) : (
        <span key={m.index} className="room-name">
          {m[2]}
          <FloorBadge floor={m[3] === "S" ? null : Number(m[3])} />
        </span>
      ),
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** The same text plainly ("Galley (floor 1) built."), for places that can only take a string. */
export function plainText(text: string): string {
  return text.replace(TOKEN, (_, _id, name: string, floor: string) => (floor === "S" ? name : `${name} (floor ${floor})`));
}
