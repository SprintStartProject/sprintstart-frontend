import { describe, it, expect } from "vitest";
import { monogramLetters, monogramTint } from "../../../../src/features/projects/projectMonogram";

describe("monogramLetters", () => {
  it("takes the initials of the first two words", () => {
    expect(monogramLetters("Apollo Program")).toBe("AP");
    expect(monogramLetters("  borealis   data  platform ")).toBe("BD");
  });

  it("takes the first two letters of a single word", () => {
    expect(monogramLetters("Apollo")).toBe("AP");
    expect(monogramLetters("X")).toBe("X");
  });

  it("falls back to a placeholder for a name with no letters", () => {
    expect(monogramLetters("")).toBe("?");
    expect(monogramLetters("   ")).toBe("?");
  });

  it("keeps characters outside the basic plane intact", () => {
    expect(monogramLetters("🚀 Launch")).toBe("🚀L");
    expect(monogramLetters("🚀🎯")).toBe("🚀🎯");
  });
});

describe("monogramTint", () => {
  it("gives a project the same tint every time", () => {
    expect(monogramTint("project-1")).toBe(monogramTint("project-1"));
  });

  it("returns a tint for any id, including an empty one", () => {
    expect(monogramTint("")).toMatch(/^bg-app-/);
  });
});
