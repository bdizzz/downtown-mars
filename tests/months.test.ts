import { describe, expect, it } from "vitest";
import { monthLabel, monthShort, monthsText } from "../src/view/months";

describe("a game day read as a month (T-021)", () => {
  it("dates the game in months, then years and months elapsed", () => {
    expect(monthLabel(1)).toBe("Month 1");
    expect(monthLabel(11)).toBe("Month 11");
    expect(monthLabel(12)).toBe("Year 1");
    expect(monthLabel(45)).toBe("Year 3, month 9");
    expect(monthShort(9)).toBe("M9");
    expect(monthShort(45)).toBe("Y3 M9");
  });

  it("words spans in months, and years and months from a year up", () => {
    expect(monthsText(1)).toBe("1 month");
    expect(monthsText(3)).toBe("3 months");
    expect(monthsText(2.46, true)).toBe("2.5 months");
    expect(monthsText(12)).toBe("1 year");
    expect(monthsText(40)).toBe("3 years 4 months");
    expect(monthsText(13)).toBe("1 year 1 month");
  });
});
