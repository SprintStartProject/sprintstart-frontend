import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readJourneyView,
  writeJourneyView,
} from "../../../../src/features/onboarding/journeyViewMemory.ts";

const KEY = "test.journey.view";

describe("journey view memory", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
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
