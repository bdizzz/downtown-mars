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

// The Godot bridge (docs/PLAN-GODOT.md): the simulation in Node, served over a local socket to the
// Godot viewer, speaking the web game's worker protocol (worker/protocol.ts) one JSON message per
// line. Godot is just another main thread: it gets snapshots and sends commands. On top of that the
// bridge sends the 3D scene (scene.ts) whenever it changes, and takes one message of its own:
// { type: "view", topFloor } (the floor picked, or null for all).
//
//   npm run bridge -- [--port=7878] [--load=save.json] [--showcase=12] [--speed=1] [--hour=12] [--verbose]

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "1"];
  }),
);
const port = Number(args.port ?? 7878);

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
let sentScene = "";
let sentPeople = "";
let spots: RoomSpots[] = [];
function sendScene(force = false): void {
  if (clients.size === 0) return;
  const state = host.active();
  const key = sceneKey(state, host.gameId(), topFloor);
  if (force || key !== sentScene) {
    sentScene = key;
    const built = buildScene(state, host.gameId(), topFloor);
    spots = built.spots;
    const scene = built.message;
    const line = JSON.stringify(scene) + "\n";
    for (const c of clients) c.write(line);
    report(scene, line);
    sentPeople = "";
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

type BridgeMessage = ToWorker | { type: "view"; topFloor: number | null };

if (args.load) host.onMessage({ type: "load", id: 0, data: readFileSync(args.load, "utf8") });
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
  // A new viewer needs the layout and the rest, whatever was sent before, and starts with every floor.
  topFloor = null;
  host.resend();
  host.post();
  sendScene(true);
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
          sendScene();
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

server.listen(port, "127.0.0.1", () => console.log(`Sim bridge on 127.0.0.1:${port}`));
setInterval(() => {
  host.frame();
  sendScene();
}, 1000 / config.snapshotsPerSecond);
setInterval(() => {
  if (sent && args.verbose) console.log(`${(sent / 1024).toFixed(0)} KB/s to ${clients.size}`);
  sent = 0;
}, 1000);
