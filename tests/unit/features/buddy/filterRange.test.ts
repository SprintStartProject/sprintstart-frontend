import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isFilterRangeInvalid,
  localDayEnd,
  localDayStart,
  toWireFilters,
} from "../../../../src/features/buddy/utils/filterRange";

const none = { sourceSystems: [], from: "", to: "" };

describe("filterRange", () => {
  const originalTz = process.env.TZ;

  // A fixed zone with daylight saving, so the offset is known and differs between seasons.
  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  describe("toWireFilters", () => {
    it("sends nothing when no filter is set", () => {
      expect(toWireFilters(none)).toBeUndefined();
    });

    it("sends only the sources when no date is set", () => {
      expect(toWireFilters({ ...none, sourceSystems: ["GITHUB"] })).toEqual({
        source_systems: ["GITHUB"],
      });
    });

    it("sends only the dates when no source is set", () => {
      expect(toWireFilters({ ...none, from: "2026-01-15", to: "2026-01-16" })).toEqual({
        time_from: "2026-01-14T23:00:00.000Z",
        time_to: "2026-01-16T22:59:59.999Z",
      });
    });

    it("sends sources and dates together", () => {
      expect(
        toWireFilters({ sourceSystems: ["GITHUB", "JIRA"], from: "2026-01-15", to: "2026-01-15" }),
      ).toEqual({
        source_systems: ["GITHUB", "JIRA"],
        time_from: "2026-01-14T23:00:00.000Z",
        time_to: "2026-01-15T22:59:59.999Z",
      });
    });

    it("sends only the bound that is set", () => {
      expect(toWireFilters({ ...none, to: "2026-01-15" })).toEqual({
        time_to: "2026-01-15T22:59:59.999Z",
      });
    });

    it("leaves out a date that cannot be read", () => {
      expect(toWireFilters({ ...none, from: "nonsense", to: "also nonsense" })).toBeUndefined();
      expect(toWireFilters({ sourceSystems: ["GITHUB"], from: "nonsense", to: "" })).toEqual({
        source_systems: ["GITHUB"],
      });
    });
  });

  describe("local day boundaries", () => {
    it("uses the summer offset in summer time", () => {
      expect(localDayStart("2026-07-15")).toBe("2026-07-14T22:00:00.000Z");
      expect(localDayEnd("2026-07-15")).toBe("2026-07-15T21:59:59.999Z");
    });

    it("uses the winter offset in winter time", () => {
      expect(localDayStart("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
      expect(localDayEnd("2026-01-15")).toBe("2026-01-15T22:59:59.999Z");
    });

    it("makes the end bound cover the whole local day", () => {
      const start = new Date(localDayStart("2026-07-15") as string).getTime();
      const end = new Date(localDayEnd("2026-07-15") as string).getTime();
      expect(end - start).toBe(24 * 60 * 60 * 1000 - 1);
    });

    it("does not clamp the end bound to now", () => {
      expect(localDayEnd("2999-12-31")).toBe("2999-12-31T22:59:59.999Z");
    });

    it("returns nothing for an invalid date", () => {
      expect(localDayStart("")).toBeUndefined();
      expect(localDayEnd("31.12.2026")).toBeUndefined();
    });
  });

  describe("isFilterRangeInvalid", () => {
    it("flags an inverted range only", () => {
      expect(isFilterRangeInvalid("2026-02-01", "2026-01-01")).toBe(true);
      expect(isFilterRangeInvalid("2026-01-01", "2026-02-01")).toBe(false);
      expect(isFilterRangeInvalid("2026-01-01", "2026-01-01")).toBe(false);
      expect(isFilterRangeInvalid("", "2026-01-01")).toBe(false);
    });
  });
});
