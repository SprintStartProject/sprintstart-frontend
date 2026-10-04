import { describe, expect, it } from "vitest";
import { gapScanState } from "../../../../../src/features/pm-area/analysis/analysisFreshness";

const scanned = (refreshedAt: string | null, refreshing = false) => ({
  gaps: [],
  refreshedAt,
  refreshing,
});

describe("gapScanState", () => {
  it("is current when the last scan is newer than every import", () => {
    expect(
      gapScanState(scanned("2026-10-01T12:00:00Z"), [
        { lastRunAt: "2026-10-01T10:00:00Z" },
        { lastRunAt: null },
      ]),
    ).toEqual({ kind: "current", scannedAt: "2026-10-01T12:00:00Z" });
  });

  it("is behind when an import is newer than the last scan", () => {
    expect(
      gapScanState(scanned("2026-10-01T10:00:00Z"), [
        { lastRunAt: "2026-09-30T10:00:00Z" },
        { lastRunAt: "2026-10-01T11:00:00Z" },
      ]),
    ).toEqual({ kind: "behind", scannedAt: "2026-10-01T10:00:00Z" });
  });

  it("is behind when there was an import but never a scan", () => {
    expect(gapScanState(scanned(null), [{ lastRunAt: "2026-10-01T10:00:00Z" }])).toEqual({
      kind: "behind",
      scannedAt: null,
    });
  });

  it("is current when nothing was imported yet — there is nothing to scan", () => {
    expect(gapScanState(scanned(null), [{ lastRunAt: null }])).toEqual({
      kind: "current",
      scannedAt: null,
    });
  });

  it("says a rescan is running rather than comparing against the previous result", () => {
    expect(
      gapScanState(scanned("2026-09-01T10:00:00Z", true), [{ lastRunAt: "2026-10-01T10:00:00Z" }]),
    ).toEqual({ kind: "refreshing" });
  });

  it("does not guess when the gaps or the sources could not be read", () => {
    expect(gapScanState(null, [])).toEqual({ kind: "unknown" });
    expect(gapScanState(scanned("2026-10-01T10:00:00Z"), null)).toEqual({ kind: "unknown" });
  });
});
