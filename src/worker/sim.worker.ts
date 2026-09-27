/// <reference lib="webworker" />
import { applyCommand } from "../sim/commands";
import { config } from "../sim/config";
import { deserialize, serialize, summarize } from "../sim/save";
import { makeSnapshot } from "../sim/snapshot";
import { createInitialState, type SimState } from "../sim/state";
import { step } from "../sim/step";
import type { FromWorker, ToWorker, WireSnapshot } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let state: SimState = createInitialState(config);
/** Bumps on every new game or load, so views drop what they cached. */
let gameId = 1;
let speed = 1;
let tickDebt = 0; // fractional ticks owed to real time
let last = performance.now();
let sentLayout = "";

function reply(msg: FromWorker): void {
  self.postMessage(msg);
}

function post(): void {
  const { layout, effects, ...rest } = makeSnapshot(state, config);
  const key = `${gameId}:${layout.version}`;
  const fresh = key !== sentLayout;
  sentLayout = key;
  const snapshot: WireSnapshot = { ...rest, gameId, layoutVersion: layout.version, ...(fresh ? { layout, effects } : {}) };
  reply({ type: "snapshot", snapshot, speed });
}

function frame(): void {
  const now = performance.now();
  tickDebt += ((now - last) / 1000) * config.ticksPerSecondAt1x * speed;
  last = now;

  // If we fall far behind (tab hidden, slow machine), drop the backlog
  // rather than freezing to catch up.
  const due = Math.min(Math.floor(tickDebt), config.maxTicksPerFrame);
  for (let i = 0; i < due; i++) step(state, config);
  tickDebt = due === config.maxTicksPerFrame ? 0 : tickDebt - due;

  post();
}

function replaceState(next: SimState): void {
  state = next;
  gameId++;
  tickDebt = 0;
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "setSpeed":
      if (config.speeds.includes(msg.speed)) speed = msg.speed;
      break;
    case "command":
      // Applied between ticks, so building works while paused.
      reply({ type: "commandResult", id: msg.id, result: applyCommand(state, msg.command) });
      break;
    case "save":
      reply({ type: "saved", id: msg.id, data: serialize(state), summary: summarize(state, config) });
      break;
    case "load": {
      const r = deserialize(msg.data);
      if (r.ok) replaceState(r.state);
      reply({ type: "loaded", id: msg.id, result: r.ok ? { ok: true } : { ok: false, reason: r.reason } });
      break;
    }
    case "newGame":
      replaceState(createInitialState(config));
      reply({ type: "loaded", id: msg.id, result: { ok: true } });
      break;
  }
  post();
};

setInterval(frame, 1000 / config.snapshotsPerSecond);
post();
