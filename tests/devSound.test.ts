import { describe, expect, it, vi } from "vitest";
import raw from "../data/settings.json";
import { DEFAULT_SETTINGS } from "../src/ui/settings";
import { isDevBuild } from "../src/ui/devBuild";
import { setAudioSettings, unlockAudio } from "../src/audio/sound";

// #539: dev and test builds start silent until the player turns sound on in Settings.
describe("sound in dev builds", () => {
  it("treats the test run as a dev build, so sound starts off", () => {
    expect(isDevBuild()).toBe(true);
    expect(DEFAULT_SETTINGS.soundOn).toBe(false);
  });

  it("shows the Sound switch only in dev builds", () => {
    const row = (raw.settings as { id: string; when?: string; control: string }[]).find((r) => r.id === "soundOn");
    expect(row?.when).toBe("devBuild");
    expect(row?.control).toBe("toggle");
  });

  it("makes no audio context until sound is on", () => {
    const made = vi.fn();
    class FakeContext {
      state = "running";
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      constructor() {
        made();
      }
      createGain = () => ({ connect: (n: unknown) => n, gain: { value: 0, setTargetAtTime() {} } });
      createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) });
      createBufferSource = () => ({ connect: (n: unknown) => n, start() {} });
      createBiquadFilter = () => ({ connect: (n: unknown) => n, frequency: { value: 0 } });
      createOscillator = () => ({ connect: (n: unknown) => n, start() {}, frequency: { value: 0 } });
      suspend = async () => {};
      resume = async () => {};
    }
    vi.stubGlobal("AudioContext", FakeContext);
    const s = { volume: 0.6, music: 0.5, effects: 1, ambience: 1 };
    setAudioSettings({ ...s, soundOn: false });
    unlockAudio();
    expect(made).not.toHaveBeenCalled();
    setAudioSettings({ ...s, soundOn: true });
    unlockAudio();
    expect(made).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
