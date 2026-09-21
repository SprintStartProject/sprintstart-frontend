import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hireJourneyViewKey,
  memberJourneyViewKey,
  readJourneyView,
  writeJourneyView,
} from "../../../../src/features/onboarding/journeyViewMemory.ts";

const KEY = "test.journey.view";

describe("journey view memory", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Browser storage is per browser, not per account or per member, so the key has to carry both.
   * These are the shapes the pages ask for; the page-level tests check that they ask.
   */
  it("keys a remembered view on who is looking, and at whom", () => {
    expect(hireJourneyViewKey("user-1")).not.toEqual(hireJourneyViewKey("user-2"));
    expect(memberJourneyViewKey("pm-1", "member-1")).not.toEqual(
      memberJourneyViewKey("pm-2", "member-1"),
    );
    expect(memberJourneyViewKey("pm-1", "member-1")).not.toEqual(
      memberJourneyViewKey("pm-1", "member-2"),
    );

    writeJourneyView(hireJourneyViewKey("user-1"), { mode: "graph", graphPhaseId: "phase-2" });

    expect(readJourneyView(hireJourneyViewKey("user-2"))).toEqual({
      mode: "list",
      graphPhaseId: null,
    });
  });

  it("opens on the list when nothing is remembered", () => {
    expect(readJourneyView(KEY)).toEqual({ mode: "list", graphPhaseId: null });
  });

  it("gives back the view and phase it was left in", () => {
    writeJourneyView(KEY, { mode: "graph", graphPhaseId: "phase-2" });

    expect(readJourneyView(KEY)).toEqual({ mode: "graph", graphPhaseId: "phase-2" });
  });

  it("falls back to the list on anything it cannot read", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readJourneyView(KEY)).toEqual({ mode: "list", graphPhaseId: null });

    window.localStorage.setItem(KEY, JSON.stringify({ mode: "map", graphPhaseId: 3 }));
    expect(readJourneyView(KEY)).toEqual({ mode: "list", graphPhaseId: null });
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeJourneyView(KEY, { mode: "graph", graphPhaseId: null })).not.toThrow();
    expect(readJourneyView(KEY)).toEqual({ mode: "list", graphPhaseId: null });
  });
});
