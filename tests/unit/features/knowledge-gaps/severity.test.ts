import { describe, it, expect } from "vitest";
import {
  SEVERITY_ORDER,
  SEVERITIES,
  SEVERITY_STYLES,
} from "../../../../src/features/knowledge-gaps/severity";

describe("knowledge-gaps severity", () => {
  describe("SEVERITY_ORDER", () => {
    it("orders high before medium before low", () => {
      expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
      expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
    });
  });

  describe("SEVERITIES", () => {
    it("lists severities in display order high → medium → low", () => {
      expect(SEVERITIES).toEqual(["high", "medium", "low"]);
    });
  });

  describe("SEVERITY_STYLES", () => {
    it("maps high to danger tokens", () => {
      expect(SEVERITY_STYLES.high.bar).toContain("danger");
      expect(SEVERITY_STYLES.high.badge).toContain("danger");
      expect(SEVERITY_STYLES.high.ring).toContain("danger");
      expect(SEVERITY_STYLES.high.label).toBe("High");
      expect(SEVERITY_STYLES.high.longLabel).toBe("High severity");
    });

    it("maps medium to warning tokens", () => {
      expect(SEVERITY_STYLES.medium.bar).toContain("warning");
      expect(SEVERITY_STYLES.medium.badge).toContain("warning");
      expect(SEVERITY_STYLES.medium.ring).toContain("warning");
      expect(SEVERITY_STYLES.medium.label).toBe("Medium");
      expect(SEVERITY_STYLES.medium.longLabel).toBe("Medium severity");
    });

    it("maps low to success tokens", () => {
      expect(SEVERITY_STYLES.low.bar).toContain("success");
      expect(SEVERITY_STYLES.low.badge).toContain("success");
      expect(SEVERITY_STYLES.low.ring).toContain("success");
      expect(SEVERITY_STYLES.low.label).toBe("Low");
      expect(SEVERITY_STYLES.low.longLabel).toBe("Low severity");
    });

    it("provides a style entry for every severity in SEVERITIES", () => {
      for (const severity of SEVERITIES) {
        expect(SEVERITY_STYLES[severity]).toBeDefined();
        expect(SEVERITY_STYLES[severity].bar).toBeTruthy();
        expect(SEVERITY_STYLES[severity].badge).toBeTruthy();
        expect(SEVERITY_STYLES[severity].label).toBeTruthy();
      }
    });
  });
});
