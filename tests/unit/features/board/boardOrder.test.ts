import { describe, it, expect } from "vitest";
import { moveTo } from "../../../../src/features/board/layout/boardOrder";

describe("moving a card in the board's order", () => {
  const order = ["a", "b", "c", "d", "e"];

  it("puts the moved card where the target one was", () => {
    expect(moveTo(order, "d", "b")).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("moves a card backwards the same way", () => {
    expect(moveTo(order, "a", "d")).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("keeps every card, whichever way it went", () => {
    expect([...moveTo(order, "e", "a")].sort()).toEqual([...order].sort());
  });

  it("lands where it was aimed even with cards hidden between the two", () => {
    // The point of naming a target rather than counting to an index: "b" and "c" are filtered off
    // the hire's screen, so on screen "e" was dropped straight onto "d" — and it still lands in
    // front of "d" in the order the server is told about, with "b" and "c" untouched.
    expect(moveTo(order, "e", "d")).toEqual(["a", "b", "c", "e", "d"]);
  });

  it("leaves the order alone when a card is moved onto itself", () => {
    expect(moveTo(order, "c", "c")).toBe(order);
  });

  it("leaves the order alone when either card is not in it", () => {
    expect(moveTo(order, "z", "b")).toBe(order);
    expect(moveTo(order, "b", "z")).toBe(order);
  });
});
