import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useRiskMap } from "../../../../src/features/offboarding";
import { offboardingService } from "../../../../src/services/offboardingService";
import type { RiskMap, RiskQuery } from "../../../../src/services/offboardingTypes";

const map = { departing: ["ada"], files: [] } as unknown as RiskMap;

function fetching() {
  return vi.spyOn(offboardingService, "fetchRiskMap").mockResolvedValue(map);
}

afterEach(() => vi.restoreAllMocks());

describe("useRiskMap", () => {
  it("requests nothing until there is a departure to rank", () => {
    const fetch = fetching();

    const { result } = renderHook(() => useRiskMap("p1", null));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("requests nothing while no project is selected", () => {
    const fetch = fetching();

    renderHook(() => useRiskMap("", { leaving: ["ada"] }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("ranks the departure of the selected project", async () => {
    const fetch = fetching();
    const query: RiskQuery = { leaving: ["ada"], reviewWeight: 0.5 };

    const { result } = renderHook(() => useRiskMap("p1", query));

    await waitFor(() => expect(result.current.data).toEqual(map));
    expect(fetch).toHaveBeenCalledWith("p1", query);
  });

  it("ranks again when who leaves changes", async () => {
    const fetch = fetching();

    const { rerender } = renderHook(({ query }) => useRiskMap("p1", query), {
      initialProps: { query: { leaving: ["ada"] } },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ query: { leaving: ["ben"] } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith("p1", { leaving: ["ben"] });
  });

  it("reports a failed ranking", async () => {
    vi.spyOn(offboardingService, "fetchRiskMap").mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRiskMap("p1", { leaving: ["ada"] }));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
