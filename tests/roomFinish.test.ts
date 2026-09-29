import { describe, expect, it } from "vitest";
import { roomFinish } from "../src/view/roomFinish";

describe("what a room is built from", () => {
  it("is the building material its cost uses most, or rock", () => {
    expect(roomFinish("bunk_dorm")).toBe("rock"); // rock 20
    expect(roomFinish("galley")).toBe("rock"); // rock 10, metal 5
    expect(roomFinish("clinic")).toBe("brick"); // brick 10, metal 5
    expect(roomFinish("life_support")).toBe("metal");
    expect(roomFinish("entrance")).toBe("rock"); // costs nothing: carved
  });
});
