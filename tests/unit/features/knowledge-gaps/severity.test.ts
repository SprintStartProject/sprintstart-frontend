import { describe, it, expect } from "vitest";
import {
  SEVERITY_ORDER,
  SEVERITIES,
  SEVERITY_STYLES,
} from "../../../../src/features/knowledge-gaps/severity";

describe("knowledge-gaps severity", () => {
  describe("SEVERITY_ORDER", () => {
    it("orders high before medium before low before covered", () => {
      expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium);
      expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low);
      // Covered is not a gap, so it must never outrank one on a panel whose
      // job is to surface what needs attention.
      expect(SEVERITY_ORDER.low).toBeLessThan(SEVERITY_ORDER.covered);
    });
  });

  describe("SEVERITIES", () => {
    it("lists severities in display order high → medium → low → covered", () => {
      expect(SEVERITIES).toEqual(["high", "medium", "low", "covered"]);
    });
  });

  describe("SEVERITY_STYLES", () => {
    // The four steps are one ramp from red to green, so each is pinned to its
    // own step of the severity scale rather than to a status role. Sharing a
    // role would let two steps collapse to the same colour unnoticed.
    it("gives each step its own rung of the severity ramp", () => {
      const rungs = SEVERITIES.map((severity) => SEVERITY_STYLES[severity].bar);

      expect(rungs).toEqual([
        "bg-app-severity-high-solid",
        "bg-app-severity-medium-solid",
        "bg-app-severity-low-solid",
        "bg-app-severity-covered-solid",
      ]);
      expect(new Set(rungs).size).toBe(SEVERITIES.length);
    });

    it("keeps badge and ring on the same rung as the bar", () => {
      for (const severity of SEVERITIES) {
        const { bar, badge, ring } = SEVERITY_STYLES[severity];
        expect(bar).toContain(`severity-${severity}`);
        expect(badge).toContain(`severity-${severity}`);
        expect(ring).toContain(`severity-${severity}`);
      }
    });

    it("labels the gap severities as severities", () => {
      expect(SEVERITY_STYLES.high.label).toBe("High");
      expect(SEVERITY_STYLES.high.longLabel).toBe("High severity");
      expect(SEVERITY_STYLES.medium.label).toBe("Medium");
      expect(SEVERITY_STYLES.medium.longLabel).toBe("Medium severity");
      expect(SEVERITY_STYLES.low.label).toBe("Low");
      expect(SEVERITY_STYLES.low.longLabel).toBe("Low severity");
    });

    it("labels covered as a state rather than a severity", () => {
      expect(SEVERITY_STYLES.covered.label).toBe("Covered");
      expect(SEVERITY_STYLES.covered.longLabel).toBe("No gaps found");
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
