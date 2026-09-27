// Synthesized sound: no audio files, just Web Audio oscillators and noise.
// The AudioContext is created on the first user gesture, as browsers require.

export type Sfx = "click" | "build" | "demolish" | "refuse" | "landing" | "chime" | "alert" | "floor";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let hum: OscillatorNode | null = null;
let humGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

const settings = { volume: 0.6, sfx: true, ambient: true };

/** Call from a user gesture (click, key) to unlock audio. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return; // No Web Audio: the game stays silent.
  }
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  ambientBus = ctx.createGain();
  ambientBus.connect(master);
  noiseBuffer = makeNoise(ctx);
  startAmbient(ctx, ambientBus);
  applySettings();
}

export function setAudioSettings(s: { volume: number; sfx: boolean; ambient: boolean }): void {
  Object.assign(settings, s);
  applySettings();
}

function applySettings(): void {
  if (!ctx || !master || !sfxBus || !ambientBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.volume, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 1 : 0, t, 0.05);
  ambientBus.gain.setTargetAtTime(settings.ambient ? 1 : 0, t, 0.3);
}

/** Brown noise: the rumble of rock and air handlers. */
function makeNoise(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Seeded-free is fine here: audio isn't part of the deterministic sim.
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function startAmbient(c: AudioContext, bus: GainNode): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  const g = c.createGain();
  g.gain.value = 0.05;
  src.connect(lp).connect(g).connect(bus);
  src.start();

  hum = c.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 58;
  humGain = c.createGain();
  humGain.gain.value = 0;
  hum.connect(humGain).connect(bus);
  hum.start();
}

/** The life-support hum grows with the number of machines running. */
export function setHum(machines: number): void {
  if (!ctx || !humGain) return;
  humGain.gain.setTargetAtTime(Math.min(0.05, machines * 0.015), ctx.currentTime, 0.5);
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number): void {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, cutoff: number, when = 0): void {
  if (!ctx || !sfxBus || !noiseBuffer) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export function play(sfx: Sfx): void {
  if (!ctx || !settings.sfx) return;
  switch (sfx) {
    case "click":
      tone(1400, 0.04, "square", 0.03);
      break;
    case "build":
      tone(180, 0.18, "sine", 0.25, 0, 90);
      noise(0.12, 0.3, 900);
      break;
    case "demolish":
      noise(0.35, 0.5, 600);
      tone(120, 0.3, "sawtooth", 0.06, 0, 60);
      break;
    case "refuse":
      tone(150, 0.12, "square", 0.05);
      tone(120, 0.16, "square", 0.05, 0.1);
      break;
    case "landing":
      tone(70, 0.9, "sine", 0.4, 0, 35);
      noise(1.2, 0.6, 300);
      break;
    case "chime":
      tone(880, 0.35, "sine", 0.12);
      tone(1318, 0.5, "sine", 0.1, 0.16);
      break;
    case "alert":
      tone(660, 0.12, "triangle", 0.12);
      tone(660, 0.12, "triangle", 0.12, 0.2);
      break;
    case "floor":
      tone(55, 0.6, "sine", 0.35, 0, 40);
      noise(0.5, 0.35, 200);
      break;
  }
}
