/// <reference lib="webworker" />
import { applyCommand } from "../sim/commands";
import { config } from "../sim/config";
import { makeSnapshot } from "../sim/snapshot";
import { createInitialState } from "../sim/state";
import { step } from "../sim/step";
import type { FromWorker, ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const state = createInitialState(config);
let speed = 1;
let tickDebt = 0; // fractional ticks owed to real time
let last = performance.now();

function post(): void {
  const msg: FromWorker = { type: "snapshot", snapshot: makeSnapshot(state, config), speed };
  self.postMessage(msg);
}

function frame(): void {
  const now = performance.now();
  tickDebt += ((now - last) / 1000) * config.ticksPerSecondAt1x * speed;
  last = now;

  // If we fall far behind (tab hidden, slow machine), drop the backlog
  // rather than freezing to catch up.
  const due = Math.min(Math.floor(tickDebt), config.maxTicksPerFrame);
  for (let i = 0; i < due; i++) step(state);
  tickDebt = due === config.maxTicksPerFrame ? 0 : tickDebt - due;

  post();
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === "setSpeed" && config.speeds.includes(msg.speed)) {
    speed = msg.speed;
  } else if (msg.type === "command") {
    // Applied between ticks, so building works while paused.
    const reply: FromWorker = { type: "commandResult", id: msg.id, result: applyCommand(state, msg.command) };
    self.postMessage(reply);
  }
  post();
};

setInterval(frame, 1000 / config.snapshotsPerSecond);
post();
