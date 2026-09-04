import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatMoment,
  formatDaysAgo,
  hoursSince,
} from "../../../src/features/onboarding-metrics/format";

describe("onboarding-metrics format helpers", () => {
  it("formats durations, and a null (unreached) as a dash — never zero", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.5)).toBe("<1h");
    expect(formatDuration(5)).toBe("5h");
    expect(formatDuration(24)).toBe("1d");
    expect(formatDuration(26)).toBe("1d 2h");
  });

  it("renders a null moment as a dash rather than a fabricated date", () => {
    expect(formatMoment(null)).toBe("—");
    expect(formatMoment("2026-07-14T00:00:00Z")).toMatch(/\d/);
  });

  it("measures elapsed hours from a past moment, null when never reached", () => {
    expect(hoursSince(null)).toBeNull();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const hours = hoursSince(twoHoursAgo);
    expect(hours).not.toBeNull();
    expect(hours as number).toBeGreaterThanOrEqual(1.9);
    expect(hours as number).toBeLessThan(2.2);
  });

  it("formats day counts relative to now", () => {
    expect(formatDaysAgo(0)).toBe("today");
    expect(formatDaysAgo(1)).toBe("yesterday");
    expect(formatDaysAgo(3)).toBe("3 days ago");
  });
});
