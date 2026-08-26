import { describe, it, expect } from "vitest";
import { matchEggPhrase } from "../../../../src/features/easter-eggs/lib/eggPhrases";

describe("matchEggPhrase", () => {
  it.each(["do a barrel roll", "do barrel roll", "do barrel", "  DO A Barrel Roll  "])(
    "recognizes %j as a barrel roll",
    (text) => {
      expect(matchEggPhrase(text)).toBe("barrel-roll");
    },
  );

  it.each(["matrix", "the matrix", "do matrix", "MATRIX"])("recognizes %j as matrix", (text) => {
    expect(matchEggPhrase(text)).toBe("matrix");
  });

  it.each(["party", "party time", "let's party", "🎉", "  PARTY  "])(
    "recognizes %j as party",
    (text) => {
      expect(matchEggPhrase(text)).toBe("party");
    },
  );

  it.each([
    "how do I do a barrel roll?",
    "the matrix movie",
    "",
    "   ",
    "partying",
    "a party for two",
  ])("treats %j as a normal message", (text) => {
    expect(matchEggPhrase(text)).toBeNull();
  });
});
