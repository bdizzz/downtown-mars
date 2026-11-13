import { describe, expect, it } from "vitest";
import { applyCommand, type SimCommand } from "../src/sim/commands";
import { config } from "../src/sim/config";
import { createHole, spanArea } from "../src/sim/geometry";
import { areaAt, checkPlacement, createLayout, placeRoom, spanRange, targetArea, type Layout, type Location } from "../src/sim/placement";
import { roomDef } from "../src/sim/rooms";
import { dragSide, fillGap, freeGap, placeAt } from "../src/sim/snap";
import { openCells } from "../src/sim/space";
import { createInitialState, type SimState } from "../src/sim/state";
import { clickWith, commitBuild, fillAt, handleAt, hoverInfoFor, dragProposal, onProposal } from "../src/view/interaction";
import type { Pick, RoomProposal, Tool } from "../src/view/types";
import { roomWork } from "../src/sim/construction";

// F-004 (PLAN-M17): rooms sized by area and placed by angle, with snapping, handles and fill rooms.

const N = config.geometry.notchesPerTurn;
const geo = config.geometry;
const bare = (): Layout => createLayout(createHole(10, 2, 3, geo));
const at = (l: Layout, id: number) => l.rooms.find((r) => r.id === id)!.at as Extract<Location, { kind: "ring" }>;
const put = (l: Layout, type: string, ring: number, start: number, span?: number, depth?: number) => {
  const r = placeRoom(l, type, { kind: "ring", floor: 1, ring, start, ...(span ? { span } : {}), ...(depth ? { depth } : {}) });
  if (!r.ok) throw new Error(`${type}: ${r.reason}`);
  return at(l, r.id!);
};

describe("a room's size is an area", () => {
  it("the same room is the same area on every ring: about 10 m wide at its middle", () => {
    const l = bare();
    for (const ring of [1, 2, 3]) {
      const range = spanRange(l.hole, "galley", ring, 1);
      expect(spanArea(10, ring, 1, range.target, geo)).toBeCloseTo(100, -1);
      // Narrower in angle the further out, but the same width in metres.
      const mid = 10 + (ring - 0.5) * 10;
      expect((range.target / N) * 2 * Math.PI * mid).toBeCloseTo(10, 0);
    }
    expect([1, 2, 3].map((ring) => spanRange(l.hole, "galley", ring, 1).target)).toEqual([153, 92, 65]);
    expect(targetArea("galley")).toBe(100);
    expect(targetArea("bunk_dorm")).toBe(200);
    expect(targetArea("farm")).toBe(400);
  });

  it("goes at any angle, with its target area unless a span is given", () => {
    const l = bare();
    const room = put(l, "galley", 2, 777);
    expect(room).toEqual({ kind: "ring", floor: 1, ring: 2, depth: 1, start: 777, span: 92 });
    expect(areaAt(l.hole, room)).toBeCloseTo(100, -1);
    // Through the turn.
    const wrap = put(l, "bunk_dorm", 1, 1400);
    expect(wrap.span).toBe(306);
    expect(l.rooms.at(-1)!.cells).toEqual([{ floor: 1, ring: 1, a0: 1400, a1: 1706 }]);
    expect(checkPlacement(l, "clinic", { kind: "ring", floor: 1, ring: 1, start: 100 })).toMatchObject({ ok: false, reason: "Overlaps Bunk dorm" });
  });

  it("an L room goes one ring deep or two, the same area either way", () => {
    const l = bare();
    const wide = put(l, "farm", 1, 0, undefined, 1);
    const deep = put(l, "farm", 2, 700, undefined, 2);
    expect(areaAt(l.hole, wide)).toBeCloseTo(400, -1);
    expect(areaAt(l.hole, deep)).toBeCloseTo(400, -1);
    expect(deep.span).toBeLessThan(wide.span);
    expect(l.rooms.at(-1)!.cells.map((c) => [c.ring, c.a0, c.a1])).toEqual([
      [2, 700, 700 + deep.span],
      [3, 700, 700 + deep.span],
    ]);
    expect(checkPlacement(l, "galley", { kind: "ring", floor: 1, ring: 1, start: 800, depth: 2 })).toMatchObject({ ok: false, reason: "Galley can't be 2 rings deep" });
  });

  it("may be 15% either side of its target, and no more", () => {
    const l = bare();
    const range = spanRange(l.hole, "galley", 1, 1);
    expect(range).toEqual({ target: 153, min: 130, max: 175 });
    const ok = (span: number) => checkPlacement(l, "galley", { kind: "ring", floor: 1, ring: 1, start: 0, span });
    expect(ok(range.min).ok).toBe(true);
    expect(ok(range.max).ok).toBe(true);
    expect(ok(range.min - 1)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Too small: at least \d+ m²$/) });
    expect(ok(range.max + 1)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Too big: up to \d+ m²$/) });
    // An old slot-shaped room is taken as it is.
    expect(checkPlacement(l, "galley", { kind: "ring", floor: 1, ring: 2, start: 0, span: 160, fixed: true }).ok).toBe(true);
  });
});

describe("fill rooms", () => {
  it("are the empty space, the tiny and small plazas, and the park", () => {
    expect(["empty_room_s", "tiny_plaza", "small_plaza", "park"].every((id) => roomDef(id).fill)).toBe(true);
    expect(roomDef("plaza").fill).toBeFalsy();
    expect(roomDef("empty_room_s").name).toBe("Empty space");
  });

  it("stretch from half to three times their area, but never past a quarter turn", () => {
    const l = bare();
    // A tiny plaza (100 m²) on ring 3: 50 to 300 m².
    const out = spanRange(l.hole, "tiny_plaza", 3, 1);
    expect(spanArea(10, 3, 1, out.min, geo)).toBeCloseTo(50, -1);
    expect(spanArea(10, 3, 1, out.max, geo)).toBeCloseTo(300, -1);
    // A small plaza (200 m²) on ring 1 would be 229° at 300%: the quarter turn is what bites.
    const inner = spanRange(l.hole, "small_plaza", 1, 1);
    expect(inner.max).toBe(N / 4);
    expect(checkPlacement(l, "small_plaza", { kind: "ring", floor: 1, ring: 1, start: 0, span: N / 4 + 1 })).toMatchObject({ ok: false, reason: "Too wide: at most a quarter of the way round" });
  });

  it("cost and take work by their area; their effects don't grow", () => {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 500, brick: 500 });
    const range = spanRange(s.layout.hole, "tiny_plaza", 1, 1);
    const cost = roomDef("tiny_plaza").cost;
    const before = { ...s.resources };
    const build = (span: number, start: number): SimCommand => ({ type: "build", room: "tiny_plaza", at: { kind: "ring", floor: 1, ring: 1, start, span } });
    expect(applyCommand(s, build(range.target, 200)).ok).toBe(true);
    expect(before.rock! - s.resources.rock!).toBeCloseTo(cost.rock!, 0);
    const mid = { ...s.resources };
    expect(applyCommand(s, build(range.target * 2, 600)).ok).toBe(true);
    expect(mid.rock! - s.resources.rock!).toBeCloseTo(cost.rock! * 2, 0);
    expect(mid.brick! - s.resources.brick!).toBeCloseTo(cost.brick! * 2, 0);
    expect(roomWork("tiny_plaza", 2)).toBeCloseTo(2 * roomWork("tiny_plaza"));
    // Demolishing gives back half of what it cost at that size.
    const big = s.layout.rooms.at(-1)!;
    const rock = s.resources.rock!;
    applyCommand(s, { type: "demolish", roomId: big.id });
    expect(s.resources.rock! - rock).toBeCloseTo(cost.rock! * 2 * config.economy.demolishRefund, 0);
  });
});

describe("snapping", () => {
  const snap = (l: Layout, type: string, ring: number, notch: number, on = true, depth = 1) => placeAt(l, type, 1, ring, depth, notch, on);

  it("off: the room sits at the pointer at exactly its target area", () => {
    const l = bare();
    put(l, "galley", 1, 0);
    expect(snap(l, "galley", 1, 240, false)).toEqual({ start: 240 - 76, span: 153, ticks: [] });
  });

  it("both ends at once: a gap the room can be is filled exactly", () => {
    const l = bare();
    put(l, "galley", 1, 0); // 0–153
    put(l, "galley", 1, 300); // 300–453: a gap of 147, within a galley's 130–175
    expect(snap(l, "galley", 1, 220)).toEqual({ start: 153, span: 147, snap: "gap", ticks: [153, 300] });
    expect(freeGap(l, 1, 1, 1, 220)).toEqual({ from: 153, to: 300 });
    expect(freeGap(l, 1, 1, 1, 100)).toBeNull();
  });

  it("one end against a neighbour: no sliver left", () => {
    const l = bare();
    put(l, "galley", 1, 0); // 0–153
    // Pointing a little past it: the room would start at 160, leaving 7 notches. It sits against it instead.
    expect(snap(l, "galley", 1, 160 + 76)).toMatchObject({ start: 153, span: 153, snap: "neighbour" });
    // And against the neighbour on the other side.
    put(l, "galley", 1, 700);
    expect(snap(l, "galley", 1, 700 - 80)).toMatchObject({ start: 700 - 153, span: 153, snap: "neighbour" });
    // Far from either: not against them.
    expect(snap(l, "galley", 1, 420).snap).not.toBe("neighbour");
  });

  it("stretches within its leeway to close a gap that's nearly its size", () => {
    const l = bare();
    put(l, "galley", 1, 0); // 0–153
    put(l, "galley", 1, 153 + 153 + 15 + 153); // a gap of 321 after the first: two galleys and 15 over
    // The first goes against its neighbour at its target (168 left over would be too big a stretch for one... but fine for the next).
    const first = snap(l, "galley", 1, 230);
    expect(first).toMatchObject({ start: 153, span: 153 });
    put(l, "galley", 1, first.start, first.span);
    // What's left is 168: inside a galley's leeway, so the next one fills it wall to wall.
    expect(snap(l, "galley", 1, 380)).toMatchObject({ start: 306, span: 168, snap: "gap" });
  });

  it("lines up with a room's end on the ring inside or outside, so corridors can run straight across", () => {
    const l = bare();
    put(l, "galley", 1, 200); // ends at 200 and 353 on ring 1
    // On ring 2, near 353: its start snaps onto that line.
    const placed = snap(l, "galley", 2, 360 + 46);
    expect(placed).toMatchObject({ start: 353, snap: "line" });
    expect(placed.ticks).toContain(353);
    // And its other end reaches for another line if its leeway gets there: a room on ring 3 ending at 450.
    put(l, "galley", 3, 385); // 385–450
    const both = snap(l, "galley", 2, 360 + 46);
    expect(both).toMatchObject({ start: 353, span: 97, snap: "line" });
    expect(both.ticks).toEqual(expect.arrayContaining([353, 450]));
  });

  it("with nothing nearer, an end snaps to the shared 10° grid", () => {
    const l = bare();
    const placed = snap(l, "galley", 2, 613);
    expect(placed.snap).toBe("grid");
    expect((placed.start % 40 === 0 || (placed.start + placed.span) % 40 === 0)).toBe(true);
    expect(placed.span).toBe(92);
    // So rooms on different rings, placed apart, still tend to share an end.
    const other = snap(l, "galley", 3, 628);
    expect([placed.start, placed.start + placed.span].some((x) => x === other.start || x === other.start + other.span)).toBe(true);
  });

  it("stairs always snap onto a stack above or below, snapping on or off", () => {
    const l = bare();
    const stairs = placeRoom(l, "stairwell", { kind: "ring", floor: 1, ring: 1, start: 613 });
    expect(stairs.ok).toBe(true);
    l.hole.floors = 4;
    for (const on of [true, false]) expect(placeAt(l, "stairwell", 2, 1, 1, 700, on)).toMatchObject({ start: 613, span: 153, snap: "stack" });
    expect(checkPlacement(l, "stairwell", { kind: "ring", floor: 2, ring: 1, start: 613 })).toMatchObject({ ok: true, merges: [stairs.id] });
    // A stack piece joins whatever size the stack is (an old slot-shaped one, say).
    expect(placeAt(l, "stairwell", 2, 1, 1, 100, true).snap).not.toBe("stack");
  });
});

describe("drag handles", () => {
  it("one side follows the pointer while the other stays put", () => {
    const l = bare();
    const room: RoomProposal = { kind: "ring", floor: 1, ring: 2, depth: 1, start: 400, span: 92 };
    expect(dragSide(l, "galley", room, "end", 503, false)).toMatchObject({ start: 400, span: 103 });
    expect(dragSide(l, "galley", room, "start", 391, false)).toMatchObject({ start: 391, span: 101 });
    // Never through its own other wall.
    expect(dragSide(l, "galley", room, "end", 300, false).span).toBeGreaterThanOrEqual(1);
  });

  it("snaps while dragging: to a neighbour, a line, the grid", () => {
    const l = bare();
    put(l, "galley", 2, 500);
    const room: RoomProposal = { kind: "ring", floor: 1, ring: 2, depth: 1, start: 400, span: 92 };
    expect(dragSide(l, "galley", room, "end", 497)).toMatchObject({ start: 400, span: 100, snap: "neighbour" });
    // Past the neighbour: it stops at its wall.
    expect(dragSide(l, "galley", room, "end", 530)).toMatchObject({ span: 100, snap: "neighbour" });
    expect(dragSide(l, "galley", room, "start", 362)).toMatchObject({ start: 360, snap: "grid" });
  });

  it("a room dragged past its range is refused, with why", () => {
    const l = bare();
    const wide = dragSide(l, "galley", { kind: "ring", floor: 1, ring: 2, depth: 1, start: 400, span: 92 }, "end", 600, false);
    expect(checkPlacement(l, "galley", { kind: "ring", floor: 1, ring: 2, depth: 1, start: wide.start, span: wide.span })).toMatchObject({ ok: false, reason: expect.stringMatching(/^Too big/) });
    // A fill room goes much further.
    expect(checkPlacement(l, "tiny_plaza", { kind: "ring", floor: 1, ring: 2, depth: 1, start: wide.start, span: wide.span }).ok).toBe(true);
  });
});

describe("double-clicking a gap with a fill room", () => {
  it("fills it wall to wall: between two rooms, or a room and where the dug-out space ends", () => {
    const l = bare();
    put(l, "galley", 2, 100); // 100–192
    put(l, "galley", 2, 400); // 400–492
    expect(fillGap(l, "tiny_plaza", 1, 2, 300)).toEqual({ ok: true, start: 192, span: 208 });
    // Dug-out space next to rock: only the stretch of the same kind under the pointer.
    openCells(l, [{ floor: 1, ring: 2, a0: 492, a1: 600 }]);
    expect(fillGap(l, "tiny_plaza", 1, 2, 520)).toEqual({ ok: true, start: 492, span: 108 });
  });

  it("says why when the gap is outside its range, and only a fill room fills", () => {
    const l = bare();
    put(l, "galley", 2, 100);
    put(l, "galley", 2, 1000);
    expect(fillGap(l, "tiny_plaza", 1, 2, 500)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Too wide: up to \d+ m²$/) });
    put(l, "galley", 2, 192 + 20);
    expect(fillGap(l, "tiny_plaza", 1, 2, 200)).toMatchObject({ ok: false, reason: expect.stringMatching(/^Too narrow/) });
    expect(fillGap(l, "galley", 1, 2, 500)).toMatchObject({ ok: false });
    expect(fillGap(l, "tiny_plaza", 1, 2, 150)).toMatchObject({ ok: false, reason: "There's a room here already" });
  });
});

describe("placing in the views", () => {
  const pickAt = (_s: SimState, ring: number, notch: number): Pick => ({ kind: "slot", floor: 1, ring, a0: 0, a1: 1, locked: false, digging: false, angle: (notch / N) * 360 });
  function world() {
    const s = createInitialState(config);
    s.drill.active = false;
    Object.assign(s.resources, { rock: 500, brick: 300, metal: 300 });
    const sent: SimCommand[] = [];
    let tool: Tool = { kind: "build", room: "galley", depth: 1 };
    const said: string[] = [];
    const opts = {
      onCommand: (c: SimCommand) => {
        sent.push(c);
        applyCommand(s, c);
      },
      onProposeRoom: (p: RoomProposal | null) => {
        if (tool?.kind !== "build") return;
        const { proposal: _old, ...rest } = tool;
        tool = p ? { ...rest, proposal: p } : rest;
      },
      onInvalid: (why: string) => said.push(why),
    };
    const click = (p: Pick) => clickWith(s.layout, tool, hoverInfoFor(s.layout, s.resources, tool, p, s.unlocks ?? []), opts);
    return { s, sent, said, opts, click, tool: () => tool as Extract<Tool, { kind: "build" }>, setTool: (t: Tool) => (tool = t) };
  }

  it("a click puts the room down as a proposal; a second click on it builds it", () => {
    const w = world();
    w.click(pickAt(w.s, 2, 300));
    expect(w.sent).toEqual([]);
    const proposal = w.tool().proposal!;
    expect(proposal).toMatchObject({ kind: "ring", floor: 1, ring: 2, depth: 1, span: 92 });
    expect(onProposal(proposal, pickAt(w.s, 2, proposal.start + 10))).toBe(true);
    // The hover shows the proposal, wherever the pointer is.
    expect(hoverInfoFor(w.s.layout, w.s.resources, w.tool(), pickAt(w.s, 3, 900)).at).toEqual(proposal);
    w.click(pickAt(w.s, 2, proposal.start + 40));
    expect(w.sent).toEqual([{ type: "build", room: "galley", at: proposal }]);
    expect(w.tool().proposal).toBeUndefined();
    expect(w.s.layout.rooms.some((r) => r.type === "galley" && r.at.kind === "ring" && r.at.start === proposal.start)).toBe(true);
  });

  it("a click elsewhere moves the proposal; its side walls are handles to drag", () => {
    const w = world();
    w.click(pickAt(w.s, 2, 300));
    const first = w.tool().proposal!;
    w.click(pickAt(w.s, 2, 700));
    const moved = w.tool().proposal!;
    expect(moved.start).not.toBe(first.start);
    expect(w.sent).toEqual([]);
    expect(handleAt(w.s.layout, moved, pickAt(w.s, 2, moved.start + 2))).toBe("start");
    expect(handleAt(w.s.layout, moved, pickAt(w.s, 2, moved.start + moved.span - 2))).toBe("end");
    expect(handleAt(w.s.layout, moved, pickAt(w.s, 2, moved.start + moved.span / 2))).toBeUndefined();
    expect(handleAt(w.s.layout, moved, pickAt(w.s, 3, moved.start))).toBeUndefined();
    const dragged = dragProposal(w.s.layout, { ...w.tool(), snap: false }, "end", pickAt(w.s, 2, moved.start + 100))!;
    expect(dragged).toMatchObject({ start: moved.start, span: 100 });
  });

  it("a proposal left invalid is never built: it says why", () => {
    const w = world();
    w.opts.onProposeRoom({ kind: "ring", floor: 1, ring: 2, depth: 1, start: 300, span: 200 });
    w.click(pickAt(w.s, 2, 350));
    expect(w.sent).toEqual([]);
    expect(w.said[0]).toMatch(/^Too big/);
    expect(w.tool().proposal).toBeDefined();
    // Enter (commitBuild) does the same.
    const info = hoverInfoFor(w.s.layout, w.s.resources, w.tool(), pickAt(w.s, 1, 0));
    expect(commitBuild(w.tool(), info, w.opts)).toBe(false);
  });

  it("stairs and surface rooms are built at once, as before", () => {
    const w = world();
    w.setTool({ kind: "build", room: "stairwell", depth: 1 });
    w.s.layout.hole.floors = 2;
    w.click(pickAt(w.s, 1, 800));
    expect(w.sent).toHaveLength(1);
    expect(w.tool().proposal).toBeUndefined();
  });

  it("double-click fills a gap with a fill room in hand, and says why when it can't", () => {
    const w = world();
    w.setTool({ kind: "build", room: "tiny_plaza", depth: 1 });
    // Between the entrance (0–153) and a galley on ring 1.
    applyCommand(w.s, { type: "build", room: "galley", at: { kind: "ring", floor: 1, ring: 1, start: 400 } });
    expect(fillAt(w.s.layout, w.s.resources, w.tool(), pickAt(w.s, 1, 250), w.opts)).toBe(true);
    expect(w.sent.at(-1)).toMatchObject({ type: "build", room: "tiny_plaza", at: { start: 153, span: 247 } });
    expect(fillAt(w.s.layout, w.s.resources, w.tool(), pickAt(w.s, 1, 900), w.opts)).toBe(true);
    expect(w.said.at(-1)).toMatch(/^Too wide/);
    // Not a fill room: the double click is nobody's.
    expect(fillAt(w.s.layout, w.s.resources, { kind: "build", room: "galley", depth: 1 }, pickAt(w.s, 1, 250), w.opts)).toBe(false);
  });
});
