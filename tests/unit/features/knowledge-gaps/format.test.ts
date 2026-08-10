import { describe, it, expect } from "vitest";
import { formatRelativeDate, formatDate } from "../../../../src/features/knowledge-gaps/format";

describe("knowledge-gaps format", () => {
  describe("formatRelativeDate", () => {
    it('returns "Today" for a timestamp from earlier today', () => {
      const iso = new Date().toISOString();
      expect(formatRelativeDate(iso)).toBe("Today");
    });

    it('returns "Yesterday" for a timestamp 1 day ago', () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeDate(oneDayAgo)).toBe("Yesterday");
    });

    it('returns "<N>d ago" for a timestamp between 2 and 29 days ago', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeDate(fiveDaysAgo)).toBe("5d ago");
    });

    it('returns "<N>mo ago" for a timestamp 30+ days ago', () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeDate(ninetyDaysAgo)).toBe("3mo ago");
    });
  });

  describe("formatDate", () => {
    it('formats an ISO timestamp as "DD Mon YYYY" in en-GB', () => {
      const iso = "2026-07-05T10:00:00Z";
      const result = formatDate(iso);
      expect(result).toMatch(/^\d{2} \w{3} \d{4}$/);
      expect(result).toContain("2026");
      expect(result).toContain("Jul");
    });
  });
});
