import { describe, expect, it } from "vitest";
import {
  formatLineRanges,
  isNodeHighlighted,
  type HastNode,
} from "../../../../src/features/knowledge-base/lineHighlight";

function nodeSpanning(start: number, end: number): HastNode {
  return {
    position: {
      start: { line: start, column: 1 },
      end: { line: end, column: 1 },
    },
  };
}

describe("isNodeHighlighted", () => {
  it("reports the node's lines and marks it when a cited line is inside", () => {
    expect(isNodeHighlighted(nodeSpanning(3, 5), [4])).toEqual({
      isHighlighted: true,
      startLine: 3,
      endLine: 5,
    });
  });

  it("includes both ends of the node", () => {
    expect(isNodeHighlighted(nodeSpanning(3, 5), [3]).isHighlighted).toBe(true);
    expect(isNodeHighlighted(nodeSpanning(3, 5), [5]).isHighlighted).toBe(true);
  });

  it("does not mark a node whose lines are not cited, but still reports them", () => {
    expect(isNodeHighlighted(nodeSpanning(3, 5), [2, 6])).toEqual({
      isHighlighted: false,
      startLine: 3,
      endLine: 5,
    });
  });

  it("marks a node when any one of several cited lines falls inside", () => {
    expect(isNodeHighlighted(nodeSpanning(3, 5), [1, 4, 9]).isHighlighted).toBe(true);
  });

  it.each([undefined, []])("reports nothing when the cited lines are %j", (lines) => {
    expect(isNodeHighlighted(nodeSpanning(3, 5), lines)).toEqual({ isHighlighted: false });
  });

  it.each([undefined, {}])("reports nothing for a node without a position (%j)", (node) => {
    expect(isNodeHighlighted(node, [3])).toEqual({ isHighlighted: false });
  });
});

describe("formatLineRanges", () => {
  it.each([undefined, []])("is empty for %j", (lines) => {
    expect(formatLineRanges(lines)).toBe("");
  });

  it("names a single line", () => {
    expect(formatLineRanges([7])).toBe("Line 7");
  });

  it("names a single line cited more than once", () => {
    expect(formatLineRanges([7, 7, 7])).toBe("Line 7");
  });

  it("spans from the first to the last line whatever the order", () => {
    expect(formatLineRanges([9, 3, 5])).toBe("Lines 3–9");
  });

  it("collapses duplicates before counting", () => {
    expect(formatLineRanges([2, 2, 3])).toBe("Lines 2–3");
  });
});
