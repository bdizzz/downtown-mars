import lighting from "../../data/lighting.json";

// Underground lighting by the hour (#305), for the web's 3D view; the Godot viewer has its own copy
// (godot/src/Lighting.cs Indoor, HoleScene.SetMode), reading the same data/lighting.json.

/** Above ground the sky lights the rooms; underground, they're lit by day, by night, or not at all after midnight. */
export type LightMode = "surface" | "day" | "night" | "off";

/** The underground mode at this time of day (0..1): day from dawn, night from dusk, off from offHour (midnight) to dawn. */
export function modeAt(dayFraction: number): Exclude<LightMode, "surface"> {
  const { dawnHour, duskHour, offHour } = lighting.switch;
  const h = dayFraction * 24;
  if (h >= dawnHour && h < duskHour) return "day";
  // Night runs from dusk round to offHour, which may be past midnight.
  const sinceDusk = (h - duskHour + 24) % 24;
  const nightLong = (offHour - duskHour + 24) % 24;
  return sinceDusk < nightLong ? "night" : "off";
}

/** A lamp's share of its strength in a mode: a room's go dark after midnight; one outside a room keeps the night's. */
export function lampLevel(mode: LightMode, dims: boolean, inRoom: boolean): number {
  if (mode === "day") return 1 + lighting.day.lampBoost;
  if (mode === "off" && inRoom) return lighting.off.lampDim;
  if (mode === "night" || mode === "off") return dims ? lighting.night.lampDim : 1;
  return 1;
}

/** A ceiling light's share in a mode: none above ground; a corridor's keep the night's after midnight. */
export function overheadLevel(mode: LightMode, staysOn: boolean, inRoom: boolean): number {
  if (mode === "day") return 1;
  if (mode === "off" && inRoom) return lighting.off.overheadDim;
  if (mode === "night" || mode === "off") return staysOn ? lighting.night.overheadDim : 0;
  return 0;
}

/** A stable 0..1 from a position: which lights dim at night, the same ones every night. */
export function pick(x: number, y: number, z: number): number {
  let h = (Math.imul(Math.round(x * 10), 73856093) ^ Math.imul(Math.round(y * 10), 19349663) ^ Math.imul(Math.round(z * 10), 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return (h & 0xffff) / 65536;
}

/** A lamp dims at night. */
export const lampDims = (x: number, y: number, z: number) => pick(x, y, z) < lighting.night.lampShareDimmed;
/** A ceiling light stays on at night. */
export const overheadStaysOn = (x: number, y: number, z: number) => pick(x, y, z) < lighting.night.overheadShareOn;

/** A light's moment in a switch of mode, in real seconds: a room's lights share one, each room its own, within the spread. */
export function switchDelay(room: number, x: number, y: number, z: number): number {
  return (room >= 0 ? pick(room * 0.37, room * 0.11, 0) : pick(x, y, z)) * lighting.switch.spreadS;
}

/**
 * The switch between modes. A change of hour switches each light at its own delay after the change,
 * so rooms switch one after another, all within the spread, whatever the game speed; going above or
 * below ground, or fresh lights, switch at once.
 */
export class LightSwitch {
  private mode: LightMode = "surface";
  private was: LightMode = "surface";
  private at = 0;
  private fresh = true;
  /** Mid-switch: some lights are in the old mode still. */
  switching = false;

  /** The lights were rebuilt: put every one in the current mode at the next set. */
  reset(): void {
    this.fresh = true;
  }

  /** The mode now, at real time `nowS`; true when lights need setting (a change, or mid-switch). */
  set(mode: LightMode, nowS: number): boolean {
    if (mode === this.mode && !this.switching && !this.fresh) return false;
    if (mode !== this.mode || this.fresh) {
      const sweep = !this.fresh && mode !== "surface" && this.mode !== "surface";
      this.was = sweep ? this.mode : mode;
      this.mode = mode;
      this.at = nowS;
      this.switching = sweep;
      this.fresh = false;
    }
    this.since = nowS - this.at;
    if (this.switching && this.since >= lighting.switch.spreadS) this.switching = false;
    return true;
  }
  private since = 0;

  /** The mode a light with this delay is in. */
  modeOf(delay: number): LightMode {
    return !this.switching || this.since >= delay ? this.mode : this.was;
  }
}
