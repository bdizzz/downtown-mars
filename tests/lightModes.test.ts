import { describe, expect, it } from "vitest";
import { LightSwitch, lampLevel, modeAt, overheadLevel, switchDelay } from "../src/view/lightModes";
import lighting from "../data/lighting.json";

// The rooms' lights by the hour underground (#305): the web's copy of the Godot viewer's rules.
describe("light modes", () => {
  const at = (h: number) => modeAt(h / 24);

  it("goes by the clock: day from dawn, night from dusk, rooms off from midnight", () => {
    expect(at(lighting.switch.dawnHour - 0.1)).toBe("off");
    expect(at(lighting.switch.dawnHour)).toBe("day");
    expect(at(12)).toBe("day");
    expect(at(lighting.switch.duskHour)).toBe("night");
    expect(at(23.9)).toBe("night");
    expect(at(0.1)).toBe("off");
  });

  it("darkens rooms after midnight but keeps corridors as by night", () => {
    expect(lampLevel("off", false, true)).toBe(lighting.off.lampDim);
    expect(lampLevel("off", true, false)).toBe(lighting.night.lampDim);
    expect(overheadLevel("off", true, true)).toBe(lighting.off.overheadDim);
    expect(overheadLevel("off", true, false)).toBe(lighting.night.overheadDim);
    expect(overheadLevel("surface", true, true)).toBe(0);
    expect(lampLevel("day", true, true)).toBe(1 + lighting.day.lampBoost);
  });

  it("gives a room's lights one moment, within the spread", () => {
    expect(switchDelay(7, 1, 2, 3)).toBe(switchDelay(7, 40, -5, 9));
    for (let room = 0; room < 50; room++) {
      const d = switchDelay(room, 0, 0, 0);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(lighting.switch.spreadS);
    }
  });

  it("switches each light at its delay after a change of hour, all within the spread of real time", () => {
    const s = new LightSwitch();
    expect(s.set("day", 100)).toBe(true);
    expect(s.modeOf(0.5)).toBe("day");
    expect(s.set("day", 101)).toBe(false);
    s.set("night", 200);
    expect(s.modeOf(0)).toBe("night");
    expect(s.modeOf(0.5)).toBe("day");
    s.set("night", 200.6);
    expect(s.modeOf(0.5)).toBe("night");
    expect(s.set("night", 200 + lighting.switch.spreadS)).toBe(true);
    expect(s.switching).toBe(false);
    expect(s.set("night", 202)).toBe(false);
  });

  it("switches at once going above or below ground, and after a rebuild", () => {
    const s = new LightSwitch();
    s.set("day", 0);
    s.set("surface", 1);
    expect(s.switching).toBe(false);
    s.set("night", 2);
    expect(s.modeOf(0.8)).toBe("night");
    s.reset();
    s.set("night", 3);
    expect(s.switching).toBe(false);
  });
});
