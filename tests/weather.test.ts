import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { applyCommand } from "../src/sim/commands";
import { makeSnapshot } from "../src/sim/snapshot";
import { daylightAt, stepWeather, stormLevel, stormOutput } from "../src/sim/weather";
import { gameTime } from "../src/sim/clock";

const tpd = config.ticksPerDay;

describe("dust storms", () => {
  it("are forecast days ahead, blow for a while, then pass, with a message at each turn", () => {
    const s = createInitialState(config);
    const w = config.weather.dustStorm;
    // Weather alone, until the first storm has come and gone.
    let forecastAt = -1;
    for (s.tick = 0; s.tick < 400 * tpd; s.tick++) {
      stepWeather(s, config);
      if (s.weather?.storm && forecastAt < 0) forecastAt = s.tick;
      if (forecastAt >= 0 && !s.weather?.storm) break;
    }
    expect(forecastAt).toBeGreaterThanOrEqual(w.earliestDay * tpd);
    const texts = s.messages.map((m) => m.text);
    expect(texts.some((t) => t.startsWith("Dust storm forecast"))).toBe(true);
    expect(texts.some((t) => t.startsWith("A dust storm has blown in"))).toBe(true);
    expect(texts.some((t) => t.startsWith("The dust storm has passed"))).toBe(true);
  });

  it("builds and clears, and dims only what it affects", () => {
    const s = createInitialState(config);
    s.tick = 1000;
    s.weather = { storm: { start: 1000, end: 1000 + tpd } };
    expect(stormLevel(s, config)).toBe(0);
    s.tick = 1000 + tpd / 2;
    expect(stormLevel(s, config)).toBe(1);
    expect(stormOutput(s, config, "solar_array")).toBeCloseTo(config.weather.dustStorm.output);
    expect(stormOutput(s, config, "life_support")).toBe(1);
    s.tick = 1000 + tpd - 1;
    expect(stormLevel(s, config)).toBeLessThan(0.1);
  });

  it("cuts what the solar arrays make, and says why", () => {
    const s = createInitialState(config);
    // Midday, when the sun is full.
    s.tick = ((12 - config.startHour) / 24) * tpd;
    const r = applyCommand(s, { type: "build", room: "solar_array", at: { kind: "surface", slot: 6 } });
    expect(r.ok).toBe(true);
    step(s, config);
    const clear = s.roomStatus[r.ok ? r.roomId! : -1]!.rate;
    s.weather = { storm: { start: s.tick - tpd / 2, end: s.tick + tpd, started: true } };
    step(s, config);
    const st = s.roomStatus[r.ok ? r.roomId! : -1]!;
    expect(st.rate).toBeCloseTo(clear * config.weather.dustStorm.output, 5);
    expect(st.limit).toBe("storm");
    expect(makeSnapshot(s, config).weather.storm).toBe(1);
  });

  it("never touches the hole's random stream", () => {
    const a = createInitialState(config);
    const b = createInitialState(config);
    for (let i = 0; i < 30 * tpd; i++) {
      a.tick++;
      stepWeather(a, config);
    }
    expect(a.rngState).toBe(b.rngState);
  });

  it("can be called up from the console, and cleared", () => {
    const s = createInitialState(config);
    s.tick = 500;
    expect(applyCommand(s, { type: "consoleStorm", days: 2, inDays: 1 }).ok).toBe(true);
    expect(s.weather?.storm).toEqual({ start: 500 + tpd, end: 500 + 3 * tpd });
    applyCommand(s, { type: "consoleStorm", days: 0 });
    expect(s.weather?.storm).toBeUndefined();
  });
});

describe("day and night", () => {
  const d = config.weather.daylight;

  it("is dark at night, full through the day, and eases through dawn and dusk", () => {
    expect(daylightAt(0, config)).toBe(0);
    expect(daylightAt(d.sunrise - d.twilightHours / 2, config)).toBe(0);
    expect(daylightAt(d.sunrise, config)).toBeCloseTo(0.5);
    expect(daylightAt(d.sunrise + d.twilightHours / 2, config)).toBe(1);
    expect(daylightAt(12, config)).toBe(1);
    expect(daylightAt(d.sunset, config)).toBeCloseTo(0.5);
    expect(daylightAt(d.sunset + d.twilightHours / 2, config)).toBe(0);
    // Rising through the dawn, falling through the dusk.
    expect(daylightAt(d.sunrise - 0.25, config)).toBeLessThan(daylightAt(d.sunrise + 0.25, config));
    expect(daylightAt(d.sunset - 0.25, config)).toBeGreaterThan(daylightAt(d.sunset + 0.25, config));
  });

  it("averages the hours the sun is up over a day", () => {
    let sum = 0;
    const n = 2400;
    for (let i = 0; i < n; i++) sum += daylightAt((24 * i) / n, config);
    expect(sum / n).toBeCloseTo((d.sunset - d.sunrise) / 24, 3);
  });

  it("stops the solar arrays at night, and says why", () => {
    const s = createInitialState(config);
    const r = applyCommand(s, { type: "build", room: "solar_array", at: { kind: "surface", slot: 6 } });
    const id = r.ok ? r.roomId! : -1;
    const toHour = (h: number) => {
      while (gameTime(s.tick, config).hour !== h) s.tick++;
    };
    toHour(0);
    step(s, config);
    expect(s.roomStatus[id]).toMatchObject({ rate: 0, limit: "night" });
    toHour(12);
    step(s, config);
    expect(s.roomStatus[id]!.rate).toBeCloseTo(1, 5);
  });
});
