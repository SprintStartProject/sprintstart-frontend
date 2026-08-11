import { describe, it, expect } from "vitest";
import { linkifyCitations } from "../../../../src/features/chatbot/markdown/linkifyCitations";

describe("linkifyCitations", () => {
  it("returns the input unchanged when max is 0", () => {
    const md = "See [1] for details.";
    expect(linkifyCitations(md, 0)).toBe(md);
  });

  it("returns the input unchanged when it contains no brackets", () => {
    const md = "No citations here.";
    expect(linkifyCitations(md, 3)).toBe(md);
  });

  it("converts markers within range into citation links", () => {
    const md = "See [1] and [2] for details.";
    expect(linkifyCitations(md, 3)).toBe("See [1](#cite-1) and [2](#cite-2) for details.");
  });

  it("leaves markers outside [1, max] untouched", () => {
    const md = "See [1] and [5] for details.";
    expect(linkifyCitations(md, 3)).toBe("See [1](#cite-1) and [5] for details.");
  });

  it("does not convert markers inside inline code spans", () => {
    const md = "Array `arr[1]` is [2] indexed.";
    expect(linkifyCitations(md, 3)).toBe("Array `arr[1]` is [2](#cite-2) indexed.");
  });

  it("does not convert markers inside fenced code blocks", () => {
    const md = "```\nconst x = arr[1];\n```\nSee [2].";
    expect(linkifyCitations(md, 3)).toBe("```\nconst x = arr[1];\n```\nSee [2](#cite-2).");
  });

  it("does not convert markers inside tilde fenced blocks", () => {
    const md = "~~~\narr[1]\n~~~\nSee [2].";
    expect(linkifyCitations(md, 3)).toBe("~~~\narr[1]\n~~~\nSee [2](#cite-2).");
  });

  it("does not re-linkify an already-linkified marker", () => {
    const md = "See [1](#cite-1) again.";
    expect(linkifyCitations(md, 3)).toBe("See [1](#cite-1) again.");
  });

  it("handles multiple markers on the same line", () => {
    const md = "[1] [2] [3]";
    expect(linkifyCitations(md, 3)).toBe("[1](#cite-1) [2](#cite-2) [3](#cite-3)");
  });

  it("leaves non-numeric bracket content untouched", () => {
    const md = "See [abc] and [note] for details.";
    expect(linkifyCitations(md, 3)).toBe(md);
  });
});
