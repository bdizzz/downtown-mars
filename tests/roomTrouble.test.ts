import { describe, expect, it } from "vitest";
import type { RoomStatus } from "../src/sim/economy";
import { troubleOf } from "../src/view/roomTrouble";

const st = (limit?: string): RoomStatus => ({ staff: 1, staffNeeded: 2, rate: 0.5, ...(limit ? { limit } : {}) });

describe("room trouble", () => {
  it("is nothing for a room running well, or standing by with its output full or stocked", () => {
    expect(troubleOf(undefined).level).toBe("ok");
    expect(troubleOf(st()).level).toBe("ok");
    expect(troubleOf(st("full:water")).level).toBe("ok");
    expect(troubleOf(st("stocked:metal")).level).toBe("ok");
    expect(troubleOf(st("kit")).level).toBe("ok");
  });

  it("warns when a room is slowed, is bad when it's short of what it runs on, and idle when paused", () => {
    expect(troubleOf(st("staff"))).toEqual({ level: "warn", icon: "👷" });
    expect(troubleOf(st("morale")).level).toBe("warn");
    expect(troubleOf(st("storm")).level).toBe("warn");
    expect(troubleOf(st("power"))).toEqual({ level: "bad", icon: "⚡" });
    expect(troubleOf(st("water")).icon).toBe("💧");
    expect(troubleOf(st("machinery"))).toEqual({ level: "bad", icon: "⚠" });
    expect(troubleOf(st("paused"))).toEqual({ level: "idle", icon: "⏸" });
  });
});
