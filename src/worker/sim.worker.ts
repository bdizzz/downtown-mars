/// <reference lib="webworker" />
import { config } from "../sim/config";
import { createSimHost } from "./host";
import type { ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const host = createSimHost((msg) => self.postMessage(msg));
self.onmessage = (e: MessageEvent<ToWorker>) => host.onMessage(e.data);
setInterval(host.frame, 1000 / config.snapshotsPerSecond);
host.post();
