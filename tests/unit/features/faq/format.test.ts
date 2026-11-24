import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatAskedAt } from "../../../../src/features/faq/format";

const NOW = new Date(2026, 9, 16, 15, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("formatAskedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["under a minute", ago(30_000), "just now"],
    ["one minute", ago(MINUTE), "1 minute ago"],
    ["several minutes", ago(12 * MINUTE), "12 minutes ago"],
    ["one hour", ago(HOUR), "1 hour ago"],
    ["several hours", ago(5 * HOUR), "5 hours ago"],
  ])("reads %s as elapsed time", (_case, iso, expected) => {
    expect(formatAskedAt(iso)).toBe(expected);
  });

  it("counts calendar days past a day, so yesterday afternoon is yesterday", () => {
    expect(formatAskedAt(new Date(2026, 9, 15, 9, 0).toISOString())).toBe("yesterday");
  });

  it("counts several calendar days", () => {
    expect(formatAskedAt(new Date(2026, 9, 11, 23, 0).toISOString())).toBe("5 days ago");
  });

  it("reads anything past thirty days in months", () => {
    expect(formatAskedAt(new Date(2026, 7, 1, 12, 0).toISOString())).toBe("2 months ago");
    expect(formatAskedAt(new Date(2026, 8, 10, 12, 0).toISOString())).toBe("1 month ago");
  });
});
