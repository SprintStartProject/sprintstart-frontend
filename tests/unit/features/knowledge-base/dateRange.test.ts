import { describe, expect, it } from "vitest";
import {
  DATE_RANGE_PRESETS,
  describeDateRange,
  isIsoDate,
  matchPreset,
  normalizeDateRange,
  resolvePreset,
  shiftIsoDate,
  todayUtc,
} from "../../../../src/features/knowledge-base/dateRange.ts";

const NOW = new Date("2026-09-24T10:00:00Z");
const [LAST_7, LAST_30] = DATE_RANGE_PRESETS;

describe("dateRange", () => {
  it("accepts only real yyyy-MM-dd calendar dates", () => {
    expect(isIsoDate("2026-09-24")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-9-24")).toBe(false);
    expect(isIsoDate("24.09.2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("counts today in UTC, the zone the server cuts days in", () => {
    // 20:00 in UTC-8 is already the next day in UTC; a `to` of the local date would end too early.
    expect(todayUtc(new Date("2026-09-24T20:00:00-08:00"))).toBe("2026-09-25");
  });

  it("shifts dates across month and year boundaries", () => {
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("resolves a preset to an absolute window that includes today", () => {
    expect(resolvePreset(LAST_7, NOW)).toEqual({ from: "2026-09-18", to: "2026-09-24" });
    expect(resolvePreset(LAST_30, NOW)).toEqual({ from: "2026-08-26", to: "2026-09-24" });
  });

  it("recognises a range as a preset only while it still equals one today", () => {
    expect(matchPreset({ from: "2026-09-18", to: "2026-09-24" }, NOW)?.id).toBe("7d");
    // The same link a day later is a fixed, custom window.
    expect(
      matchPreset({ from: "2026-09-18", to: "2026-09-24" }, new Date("2026-09-25T10:00:00Z")),
    ).toBeNull();
    expect(matchPreset({ from: "2026-09-18", to: null }, NOW)).toBeNull();
  });

  it("drops invalid ends and swaps a reversed pair instead of sending a 400", () => {
    expect(normalizeDateRange({ from: "2026-09-30", to: "2026-09-01" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(normalizeDateRange({ from: "nope", to: "2026-09-01" })).toEqual({
      from: null,
      to: "2026-09-01",
    });
  });

  it("describes closed, open and single-day ranges", () => {
    expect(describeDateRange({ from: null, to: null })).toBeNull();
    expect(describeDateRange({ from: "2026-09-01", to: "2026-09-24" })).toMatch(/^Added .+ – .+$/);
    expect(describeDateRange({ from: "2026-09-01", to: null })).toMatch(/^Added since .*2026/);
    expect(describeDateRange({ from: null, to: "2026-09-24" })).toMatch(/^Added until .*2026/);
    expect(describeDateRange({ from: "2026-09-24", to: "2026-09-24" })).not.toContain("–");
  });

  it("prints the UTC calendar day, not the local day before it", () => {
    // `Date` parses a bare date as UTC midnight; a local-zone format would say Aug 31 west of UTC.
    expect(describeDateRange({ from: "2026-09-01", to: null })).toMatch(/\b1\b/);
  });
});
