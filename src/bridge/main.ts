import "./dom";
import { createServer, type Socket } from "node:net";
import { readFileSync } from "node:fs";
import { config } from "../sim/config";
import { createSimHost } from "../worker/host";
import type { FromWorker, ToWorker } from "../worker/protocol";
import { buildPeople, buildScene, peopleKey, sceneKey } from "./scene";
import { gameTime } from "../sim/clock";
import { stepWorld } from "../sim/worldstep";
import type { RoomSpots } from "../render3d/people3d";
import { inspect, roomAtPoint } from "./inspect";
import { edgeCommand, edgeHover, hover, palette, paletteKey, place, type BuildTool, type CorridorTool } from "./build";
import { walkMap } from "./walkmap";
import { dayOf, isSlot, readSlot, savesList, writeSlot } from "./saves";
import { office, officeKey } from "./office";
import { flows, trends } from "./charts";
import { mapView, networkView, siteView } from "./network";
import { constructionView, maintenanceViewOf, peopleView } from "./colony";
import { rigKey, rigMessage } from "./rig";
import { planKey, planMessage } from "./plan";
import { terrainKey, terrainMessage } from "./terrain";
import { emittersKey, emittersOf } from "../render3d/effects3d";

// The Godot bridge (docs/PLAN-GODOT.md): the simulation in Node, served over a local socket to the
// Godot viewer, speaking the web game's worker protocol (worker/protocol.ts) one JSON message per
// line. Godot is just another main thread: it gets snapshots and sends commands. On top of that the
// bridge sends the 3D scene (scene.ts) whenever it changes, who's where (people), and the room in the
// panel (inspect.ts); and takes messages of its own: { type: "view", topFloor } (the floor picked, or
// null for all) and { type: "inspect", roomId | at } (the room to show, or what's at a point).
//
//   npm run bridge -- [--port=17878] [--load=save.json] [--showcase=12] [--speed=1] [--hour=12] [--continue] [--no-autosave] [--verbose]
//
// Saves go to ~/.downtown-mars/saves (or DM_SAVES): an autosave each new game day, and three slots.

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "1"];
  }),
);
const port = Number(args.port ?? 17878);

const clients = new Set<Socket>();
let sent = 0;

function broadcast(msg: FromWorker): void {
  if (clients.size === 0) return;
  const line = JSON.stringify(msg) + "\n";
  for (const c of clients) c.write(line);
  sent += line.length;
}

const host = createSimHost(broadcast);

// The 3D scene: built again whenever the layout, the drill, wear or the picked floor change.
let topFloor: number | null = null;
let roomColors = true;
/** The plan view's floor while it's open (null when shut). */
let planFloor: number | null = null;
let sentPlan = "";
let sentScene = "";
let sentPeople = "";
let sentRig = "";
let sentFx = "";
let sentTerrain = "";
let spots: RoomSpots[] = [];
function sendScene(force = false): void {
  if (clients.size === 0) return;
  const state = host.active();
  const key = sceneKey(state, host.gameId(), topFloor, roomColors);
  if (force || key !== sentScene) {
    sentScene = key;
    const built = buildScene(state, host.gameId(), topFloor, roomColors);
    spots = built.spots;
    const scene = built.message;
    const line = JSON.stringify(scene) + "\n";
    for (const c of clients) c.write(line);
    report(scene, line);
    sentPeople = "";
  }
  // Room effects: the furnaces' and scrubbers' spots, and how hard each room is running (Godot animates them).
  const fk = `${state.holeId}:${emittersKey(state.layout, state.roomStatus)}`;
  if (force || fk !== sentFx) {
    sentFx = fk;
    const emitters = emittersOf(state.layout, state.roomStatus).map(({ kind, x, y, z, fx, fz, rate, floor }) => ({ kind, x, y, z, fx, fz, rate, floor }));
    const fxLine = JSON.stringify({ type: "fx", emitters }) + "\n";
    for (const c of clients) c.write(fxLine);
  }
  // The plan, while it's open: again whenever what it shows changes.
  if (planFloor !== null) {
    const pk = planKey(state, planFloor, roomColors);
    if (force || pk !== sentPlan) {
      sentPlan = pk;
      const t0 = performance.now();
      const plan = planMessage(state, planFloor, roomColors);
      const planLine = JSON.stringify(plan) + "\n";
      for (const c of clients) c.write(planLine);
      if (args.verbose) console.log(`Plan of floor ${planFloor}: ${plan.ops.length} ops, ${plan.markers.length} rooms, ${(planLine.length / 1024).toFixed(0)} KB, ${(performance.now() - t0).toFixed(0)} ms`);
    }
  } else sentPlan = "";
  // The land round the hole: once per hole.
  const tk = terrainKey(state);
  if (force || tk !== sentTerrain) {
    sentTerrain = tk;
    const t0 = performance.now();
    const terrainLine = JSON.stringify(terrainMessage(state)) + "\n";
    for (const c of clients) c.write(terrainLine);
    if (args.verbose) console.log(`Terrain: ${(terrainLine.length / 1e6).toFixed(1)} MB, ${(performance.now() - t0).toFixed(0)} ms`);
  }
  // The drill rig: again for another hole, or when its grippers brace.
  const rk = rigKey(state, host.gameId());
  if (force || rk !== sentRig) {
    sentRig = rk;
    const rigLine = JSON.stringify(rigMessage(state)) + "\n";
    for (const c of clients) c.write(rigLine);
  }
  // Who's where: by the hour, each room's staff and the head count.
  const pk = peopleKey(state, sentScene);
  if (pk === sentPeople) return;
  sentPeople = pk;
  const line = JSON.stringify(buildPeople(state, spots)) + "\n";
  for (const c of clients) c.write(line);
}

function report(scene: ReturnType<typeof buildScene>["message"], line: string): void {
  if (args.verbose) {
    console.log(`Scene: ${scene.chunks.length} chunks, ${scene.lamps.length} lamps, ${(line.length / 1e6).toFixed(1)} MB, built in ${scene.buildMs.toFixed(0)} ms`);
    const bytes = new Map<string, number>();
    for (const c of scene.chunks) {
      const name = scene.materials[c.material]!.name;
      bytes.set(name, (bytes.get(name) ?? 0) + c.positions.length + (c.normals?.length ?? 0) + (c.colors?.length ?? 0));
    }
    for (const [name, b] of [...bytes].sort((x, y) => y[1] - x[1]).slice(0, 8)) console.log(`  ${(b / 1e6).toFixed(1)} MB  ${name}`);
  }
}

type BridgeMessage =
  | ToWorker
  | { type: "view"; topFloor: number | null; roomColors?: boolean; plan?: number | null }
  /** The room panel: a room by id, or whatever is at a world point; null closes it. */
  | { type: "inspect"; roomId?: number | null; at?: [number, number, number] }
  /** The room under the pointer (for the hover outline): answered with { type: "picked", roomId }. */
  | { type: "pick"; at: [number, number, number] | null }
  /** Building: what placing the tool's room at a world point would do, and doing it. */
  | { type: "hover"; tool: BuildTool; at: [number, number, number] }
  | { type: "place"; tool: BuildTool; at: [number, number, number]; confirmed?: boolean }
  /** Corridors, bulkheads and windows: what the tool would do at the border nearest a point, and doing it (a click, or painting on a drag). */
  | { type: "edgeHover"; tool: CorridorTool; at: [number, number, number] }
  | { type: "edge"; tool: CorridorTool; at: [number, number, number]; painting?: boolean }
  /** Saves (saves.ts): the slots, saving to one, loading one. */
  | { type: "saves" }
  | { type: "saveSlot"; slot: string }
  | { type: "loadSlot"; slot: string }
  /** Charts (charts.ts): trends for a series over a range (amounts, or change per day), and a flow tab's rivers. */
  | { type: "trends"; key: string; range: "2d" | "10d" | "all"; mode: "amount" | "rate" }
  | { type: "flows"; tab: string }
  /** The network (network.ts): what the map shows, the network panel, and a site's report. */
  | { type: "map" }
  /** The colony panels (colony.ts): people, the construction queue, upkeep. */
  | { type: "colony"; tab: "people" | "construction" | "maintenance" }
  | { type: "network" }
  | { type: "site"; lat: number; lon: number }
  /** The viewer that started this bridge is closing: autosave and stop. */
  | { type: "quit" }
  /** First person: a floor's walking map (walkmap.ts). */
  | { type: "walkmap"; floor: number };

function send(msg: object): void {
  const line = JSON.stringify(msg) + "\n";
  for (const c of clients) c.write(line);
}

let shownHole: number | null = null;

// The office: sent when it changes.
let sentOffice = "";
function sendOffice(force = false): void {
  const key = officeKey(host.active());
  if (!force && key === sentOffice) return;
  sentOffice = key;
  send(office(host.active()));
}

// The build palette: sent when what can be built changes.
let sentPalette = "";
function sendPalette(force = false): void {
  const key = paletteKey(host.active());
  if (!force && key === sentPalette) return;
  sentPalette = key;
  send(palette(host.active()));
}
let commandId = 1_000_000;

// The room in the panel, kept up to date twice a second.
let inspecting: number | null = null;
let inspectClock = 0;
function sendInspect(): void {
  const line = JSON.stringify(inspect(host.active(), inspecting)) + "\n";
  for (const c of clients) c.write(line);
}

if (args.load) host.onMessage({ type: "load", id: 0, data: readFileSync(args.load, "utf8") });
// Pick up where the last game left off, if there's an autosave (the viewer starts its bridge so).
else if (args.continue) {
  const data = readSlot("autosave");
  if (data) {
    host.onMessage({ type: "load", id: 0, data });
    console.log("Continuing from the autosave");
  }
}
if (args.showcase) host.onMessage({ type: "command", id: 0, command: { type: "consoleShowcase", floors: Number(args.showcase) } });
// Run on to an hour of the day (for comparable screenshots and benchmarks: with --speed=0 it stays there).
if (args.hour) {
  const world = host.world();
  for (let i = 0; i < config.ticksPerDay && gameTime(world.tick, config).hour !== Number(args.hour); i++) stepWorld(world, config);
}
host.onMessage({ type: "setSpeed", speed: Number(args.speed ?? 1) });

const server = createServer((socket) => {
  socket.setNoDelay(true);
  socket.setEncoding("utf8");
  clients.add(socket);
  console.log(`Godot connected (${clients.size})`);
  // First, say who we are: the viewer counts itself connected only once it hears this (anything else could be on the port).
  socket.write(JSON.stringify({ type: "hello", bridge: "downtown-mars" }) + "\n");
  // A new viewer needs the layout and the rest, whatever was sent before, and starts with every floor.
  topFloor = null;
  planFloor = null;
  inspecting = null;
  host.resend();
  host.post();
  sendScene(true);
  sendPalette(true);
  sendOffice(true);
  let buffer = "";
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as BridgeMessage;
        if (msg.type === "view") {
          topFloor = msg.topFloor;
          if (msg.roomColors !== undefined) roomColors = msg.roomColors;
          if (msg.plan !== undefined) planFloor = msg.plan;
          sendScene();
        } else if (msg.type === "hover") {
          send(hover(host.active(), msg.tool, msg.at));
        } else if (msg.type === "place") {
          const r = place(host.active(), msg.tool, msg.at, !!msg.confirmed);
          if (r.command) host.onMessage({ type: "command", id: commandId++, command: r.command });
          else send({ type: "notice", text: r.refusal ?? r.confirm, ...(r.confirm ? { confirm: { tool: msg.tool, at: msg.at } } : {}) });
          send(hover(host.active(), msg.tool, msg.at));
        } else if (msg.type === "edgeHover") {
          send(edgeHover(host.active(), msg.tool, msg.at));
        } else if (msg.type === "edge") {
          // A click says why not; painting along a drag skips what it can't do, quietly.
          const r = edgeCommand(host.active(), msg.tool, msg.at);
          if (r.command && !r.refusal) host.onMessage({ type: "command", id: commandId++, command: r.command });
          else if (r.refusal && !msg.painting) send({ type: "notice", text: r.refusal });
          send(edgeHover(host.active(), msg.tool, msg.at));
        } else if (msg.type === "colony") {
          const s = host.snapshot();
          send(msg.tab === "construction" ? constructionView(s) : msg.tab === "maintenance" ? maintenanceViewOf(s) : peopleView(s));
        } else if (msg.type === "map") {
          send(mapView(host.snapshot()));
        } else if (msg.type === "network") {
          send(networkView(host.snapshot()));
        } else if (msg.type === "site") {
          send(siteView(host.snapshot(), { lat: msg.lat, lon: msg.lon }));
        } else if (msg.type === "trends") {
          send(trends(host.active(), msg.key, msg.range, msg.mode));
        } else if (msg.type === "flows") {
          send(flows(host.active(), msg.tab));
        } else if (msg.type === "saves") {
          send(savesList());
        } else if (msg.type === "saveSlot") {
          if (!isSlot(msg.slot)) continue;
          try {
            writeSlot(host.world(), msg.slot);
            send({ type: "notice", text: `Saved to ${msg.slot === "autosave" ? "the autosave" : `slot ${msg.slot.slice(4)}`}` });
          } catch (e) {
            send({ type: "notice", text: `Couldn't save: ${(e as Error).message}` });
          }
          send(savesList());
        } else if (msg.type === "loadSlot") {
          const data = isSlot(msg.slot) ? readSlot(msg.slot) : null;
          if (data) {
            host.onMessage({ type: "load", id: commandId++, data });
            lastDay = dayOf(host.world());
          } else send({ type: "notice", text: "Nothing saved there" });
        } else if (msg.type === "quit") {
          shutDown("the viewer closed");
        } else if (msg.type === "walkmap") {
          const map = walkMap(host.active(), msg.floor);
          if (args.verbose) console.log(`Walk map for floor ${msg.floor}: ${map.regions.length} regions, ${(map.runs.length / 1024).toFixed(0)} KB of runs, ${map.buildMs.toFixed(0)} ms`);
          send(map);
        } else if (msg.type === "pick") {
          send({ type: "picked", roomId: msg.at ? roomAtPoint(host.active(), msg.at) : null });
        } else if (msg.type === "inspect") {
          inspecting = msg.at ? roomAtPoint(host.active(), msg.at) : (msg.roomId ?? null);
          sendInspect();
        } else host.onMessage(msg);
      } catch (e) {
        console.error("Bad message:", line.slice(0, 200), e);
      }
    }
  });
  const drop = () => {
    clients.delete(socket);
    console.log(`Godot disconnected (${clients.size})`);
  };
  socket.on("close", drop);
  socket.on("error", drop);
});

server.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code !== "EADDRINUSE") throw e;
  console.error(`Port ${port} is taken: another bridge is running (stop it, or use --port=<n> here and in the viewer).`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => console.log(`Sim bridge on 127.0.0.1:${port}`));

/** Stop, saving the game to the autosave first (unless autosave is off). */
function shutDown(why: string): void {
  if (!args["no-autosave"]) {
    try {
      writeSlot(host.world(), "autosave");
      console.log(`Autosaved (${why})`);
    } catch (e) {
      console.error("Autosave failed:", e);
    }
  }
  process.exit(0);
}
process.on("SIGTERM", () => shutDown("stopped"));
process.on("SIGINT", () => shutDown("stopped"));
// Autosave as the web does, each new game day (--no-autosave to stop it).
let lastDay = dayOf(host.world());
setInterval(() => {
  const day = dayOf(host.world());
  if (day === lastDay) return;
  lastDay = day;
  if (args["no-autosave"]) return;
  try {
    writeSlot(host.world(), "autosave");
    if (clients.size) send(savesList());
  } catch (e) {
    console.error("Autosave failed:", e);
  }
}, 1000);

setInterval(() => {
  host.frame();
  sendScene();
  if (clients.size) {
    sendPalette();
    sendOffice();
    // Another hole in view: the room panel was about one in the last.
    const hole = host.active().holeId;
    if (hole !== shownHole) {
      if (shownHole !== null && inspecting !== null) {
        inspecting = null;
        sendInspect();
      }
      shownHole = hole;
    }
  }
  if (inspecting !== null && ++inspectClock % Math.round(config.snapshotsPerSecond / 2) === 0) sendInspect();
}, 1000 / config.snapshotsPerSecond);
setInterval(() => {
  if (sent && args.verbose) console.log(`${(sent / 1024).toFixed(0)} KB/s to ${clients.size}`);
  sent = 0;
}, 1000);
