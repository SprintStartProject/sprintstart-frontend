import { describe, it, expect } from "vitest";
import { formatRelativeDate, formatDate } from "../../../../src/features/knowledge-gaps/format";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("knowledge-gaps format", () => {
  describe("formatRelativeDate", () => {
    it('returns "just now" for a timestamp seconds old', () => {
      expect(formatRelativeDate(new Date().toISOString())).toBe("just now");
    });

    it("counts minutes for a timestamp under an hour old", () => {
      expect(formatRelativeDate(new Date(Date.now() - 12 * MINUTE).toISOString())).toBe(
        "12 minutes ago",
      );
    });

    it("counts hours for a timestamp under a day old", () => {
      // "Today" used to answer the wrong question here: someone watching an
      // ingestion run wants to know whether it was minutes or hours ago.
      expect(formatRelativeDate(new Date(Date.now() - 3 * HOUR).toISOString())).toBe("3 hours ago");
    });

    it("uses the singular for exactly one unit", () => {
      expect(formatRelativeDate(new Date(Date.now() - HOUR).toISOString())).toBe("1 hour ago");
    });

    it('returns "yesterday" for a timestamp a day ago', () => {
      expect(formatRelativeDate(new Date(Date.now() - DAY).toISOString())).toBe("yesterday");
    });

    it("counts days for a timestamp between 2 and 29 days ago", () => {
      expect(formatRelativeDate(new Date(Date.now() - 5 * DAY).toISOString())).toBe("5 days ago");
    });

    it("counts months for a timestamp 30+ days ago", () => {
      expect(formatRelativeDate(new Date(Date.now() - 90 * DAY).toISOString())).toBe(
        "3 months ago",
      );
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
