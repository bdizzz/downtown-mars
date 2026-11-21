import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { config } from "../src/sim/config";
import { applyCommand } from "../src/sim/commands";
import { createInitialState } from "../src/sim/state";
import { step } from "../src/sim/step";
import { flowRooms, Flows, FLOW_NETS } from "../src/render3d/flows3d";

function hole() {
  const s = createInitialState(config);
  Object.assign(s.resources, { rock: 500, metal: 300, brick: 200, machinery: 50, electronics: 50 });
  const build = (room: string, at: object) => {
    const r = applyCommand(s, { type: "build", room, at: at as never });
    if (!r.ok) throw new Error(`${room}: ${r.reason}`);
    return r.roomId!;
  };
  const solar = build("solar_array", { kind: "surface", slot: 6 });
  const galley = build("galley", { kind: "ring", floor: 1, ring: 1, slot: 3, w: 1, d: 1 });
  const dorm = build("bunk_dorm", { kind: "ring", floor: 1, ring: 1, slot: 4, w: 2, d: 1 });
  for (let i = 0; i < 3; i++) step(s, config);
  return { s, solar, galley, dorm };
}

describe("resource flows", () => {
  it("know what feeds each network and what draws from it", () => {
    const { s, solar, galley, dorm } = hole();
    const r = flowRooms(s.layout, s.roomStatus, config, null);
    expect(r.feeds.power).toContain(solar);
    expect(r.draws.power).toContain(galley);
    expect(r.feeds.food).toContain(galley);
    // Homes breathe.
    expect(r.draws.air).toContain(dorm);
    // With a floor picked, the surface and anything above it drop out.
    expect(flowRooms(s.layout, s.roomStatus, config, 1).feeds.power).not.toContain(solar);
  });

  it("build a pipe network per resource, with dashes running along the spokes", () => {
    const { s } = hole();
    const flows = new Flows();
    flows.build(s.layout, flowRooms(s.layout, s.roomStatus, config, null));
    const nets = flows.group.children.map((o) => o.userData.net);
    expect(nets).toContain("power");
    expect(nets.every((n) => FLOW_NETS.some((f) => f.id === n))).toBe(true);
    const power = flows.group.children.find((o) => o.userData.net === "power") as THREE.Mesh;
    const move = power.geometry.getAttribute("aMove");
    const moving = Array.from({ length: move.count }, (_, i) => move.getX(i));
    expect(moving).toContain(1);
    flows.clear();
    expect(flows.group.children).toHaveLength(0);
  });
});
