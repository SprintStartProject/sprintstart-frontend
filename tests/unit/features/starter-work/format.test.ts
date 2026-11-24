import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactToastDetail,
  formatRelativeDate,
} from "../../../../src/features/starter-work/format";

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [MINUTE, "1 minute ago"],
    [2 * MINUTE, "2 minutes ago"],
    [59 * MINUTE, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [2 * HOUR, "2 hours ago"],
    [23 * HOUR, "23 hours ago"],
  ])("words an age of %i ms as %s", (elapsedMs, expected) => {
    expect(formatRelativeDate(ago(elapsedMs))).toBe(expected);
  });

  it.each([
    [24 * HOUR, "yesterday"],
    [36 * HOUR, "yesterday"],
    [2 * DAY, "2 days ago"],
    [29 * DAY, "29 days ago"],
    [30 * DAY, "1 month ago"],
    [59 * DAY, "1 month ago"],
    [60 * DAY, "2 months ago"],
  ])("words an age of %i ms by calendar day as %s", (elapsedMs, expected) => {
    expect(formatRelativeDate(ago(elapsedMs))).toBe(expected);
  });
});

describe("compactToastDetail", () => {
  it("collapses runs of whitespace and trims the ends", () => {
    expect(compactToastDetail("  first \n\n  second\tthird  ", 100)).toBe("first second third");
  });

  it("keeps text that is exactly as long as the limit", () => {
    expect(compactToastDetail("abcde", 5)).toBe("abcde");
  });

  it("cuts longer text to the limit, ending in an ellipsis", () => {
    expect(compactToastDetail("abcdefgh", 5)).toBe("abcd…");
  });

  it("drops the space left dangling before the ellipsis", () => {
    expect(compactToastDetail("abc   def", 5)).toBe("abc…");
  });
});
