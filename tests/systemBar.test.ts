import { describe, expect, it } from "vitest";
import { canHideSystemBar, isIOS } from "../src/ui/systemBar";

describe("the system bar setting", () => {
  it("knows iPhones and iPads, including iPads that say they're Macs", () => {
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIOS("Mozilla/5.0 (Linux; Android 15; Pixel 9)", 5)).toBe(false);
  });

  it("is off where there's no page to make full screen", () => {
    expect(canHideSystemBar()).toBe(false);
  });
});
