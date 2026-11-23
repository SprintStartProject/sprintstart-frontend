import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useProjectMembers } from "../../../../src/features/offboarding";
import { offboardingService } from "../../../../src/services/offboardingService";
import type { MembersOverview } from "../../../../src/services/offboardingTypes";

const overview: MembersOverview = { matched: 1, total: 1, members: [] };

afterEach(() => vi.restoreAllMocks());

describe("useProjectMembers", () => {
  it("asks for nothing while no project is selected", () => {
    const fetch = vi.spyOn(offboardingService, "fetchMembers").mockResolvedValue(overview);

    const { result } = renderHook(() => useProjectMembers(""));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("loads the members of the selected project", async () => {
    const fetch = vi.spyOn(offboardingService, "fetchMembers").mockResolvedValue(overview);

    const { result } = renderHook(() => useProjectMembers("p1"));

    await waitFor(() => expect(result.current.data).toEqual(overview));
    expect(fetch).toHaveBeenCalledWith("p1");
  });

  it("loads again for another project", async () => {
    const fetch = vi.spyOn(offboardingService, "fetchMembers").mockResolvedValue(overview);

    const { rerender } = renderHook(({ project }) => useProjectMembers(project), {
      initialProps: { project: "p1" },
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ project: "p2" });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("p2"));
  });

  it("reports a failure", async () => {
    vi.spyOn(offboardingService, "fetchMembers").mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useProjectMembers("p1"));

    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
