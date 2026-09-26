import { describe, expect, it } from "vitest";
import { formatResultRange } from "../../../../src/features/knowledge-base/resultRange.ts";

describe("formatResultRange", () => {
  it("reads a middle page as a range of the total", () => {
    expect(formatResultRange(412, { start: 21, end: 40 })).toBe("21–40 of 412 artifacts");
  });

  it("drops the range when one page holds everything", () => {
    expect(formatResultRange(12, { start: 1, end: 12 })).toBe("12 artifacts");
  });

  it("uses the singular for a single artifact", () => {
    expect(formatResultRange(1, { start: 1, end: 1 })).toBe("1 artifact");
  });

  it("says No artifacts for an empty result", () => {
    expect(formatResultRange(0, { start: 1, end: 0 })).toBe("No artifacts");
    expect(formatResultRange(0)).toBe("No artifacts");
  });

  it("falls back to the total without a usable range", () => {
    expect(formatResultRange(50)).toBe("50 artifacts");
    expect(formatResultRange(50, { start: 0, end: 0 })).toBe("50 artifacts");
  });
});
