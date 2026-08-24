import { describe, it, expect } from "vitest";

import { describeEmptyState } from "../../../../src/features/knowledge-gaps/emptyState";

const SCANNED_AT = "2026-08-16T14:03:35.000Z";

describe("describeEmptyState", () => {
  it("reports a failed load as an error", () => {
    expect(describeEmptyState(null, true).state).toBe("error");
  });

  it("treats missing data as an error even without the error flag", () => {
    expect(describeEmptyState(null, false).state).toBe("error");
  });

  // The distinction the whole helper exists for: a scan that finished and found
  // nothing is the opposite answer to a project that was never scanned, and the
  // two used to render the same "trigger a scan" message.
  it("separates a completed clean scan from a project that was never scanned", () => {
    const clean = describeEmptyState({ gaps: [], refreshedAt: SCANNED_AT }, false);
    const unscanned = describeEmptyState({ gaps: [] }, false);

    expect(clean.state).toBe("clean");
    expect(clean.scannedAt).toBe(SCANNED_AT);
    expect(unscanned.state).toBe("unscanned");
    expect(unscanned.scannedAt).toBeNull();
    expect(clean.message).not.toBe(unscanned.message);
  });

  it("treats a null scan time as never scanned", () => {
    expect(describeEmptyState({ gaps: [], refreshedAt: null }, false).state).toBe("unscanned");
  });

  // A running rescan describes the panel better than the result it is replacing.
  it("prefers a running rescan over the previous result", () => {
    const info = describeEmptyState({ gaps: [], refreshing: true, refreshedAt: SCANNED_AT }, false);

    expect(info.state).toBe("scanning");
    expect(info.scannedAt).toBeNull();
  });

  it("reports the load failure ahead of anything the stale data would say", () => {
    expect(describeEmptyState({ gaps: [], refreshing: true }, true).state).toBe("error");
  });
});
