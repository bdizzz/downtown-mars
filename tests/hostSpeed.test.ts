import { describe, expect, it } from "vitest";
import { config } from "../src/sim/config";
import { serialize } from "../src/sim/save";
import { createWorld } from "../src/sim/world";
import { createSimHost } from "../src/worker/host";
import type { FromWorker } from "../src/worker/protocol";

// T-146: a loaded game starts paused; a new one at 1×.
describe("the speed after a load", () => {
  function host() {
    const replies: FromWorker[] = [];
    const h = createSimHost((m) => replies.push(m));
    const speed = () => {
      const snaps = replies.filter((m) => m.type === "snapshot");
      return (snaps[snaps.length - 1] as Extract<FromWorker, { type: "snapshot" }>).speed;
    };
    return { h, speed };
  }

  it("a loaded game starts paused", () => {
    const { h, speed } = host();
    h.onMessage({ type: "setSpeed", speed: 4 });
    h.onMessage({ type: "load", id: 1, data: serialize(createWorld(config, 7)) });
    expect(speed()).toBe(0);
  });

  it("a new game starts at 1×", () => {
    const { h, speed } = host();
    h.onMessage({ type: "setSpeed", speed: 0 });
    h.onMessage({ type: "newGame", id: 1 });
    expect(speed()).toBe(1);
  });
});
