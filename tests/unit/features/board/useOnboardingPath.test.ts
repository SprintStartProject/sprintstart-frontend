import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnboardingPath } from "../../../../src/features/board/hooks/useOnboardingPath";
import { announceBuddyPathChanged } from "../../../../src/features/buddy/aiBuddyBus";
import type { OnboardingPathEndpoint } from "../../../../src/features/onboarding/types";
import { ApiError } from "../../../../src/services/apiClient";
import { onboardingService } from "../../../../src/services/onboardingService";

const pathNamed = (id: string) => ({ id, phases: [] }) as unknown as OnboardingPathEndpoint;

afterEach(() => vi.restoreAllMocks());

describe("useOnboardingPath", () => {
  it("settles to no path on a 404", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    const { result } = renderHook(() => useOnboardingPath());

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.path).toBeNull();
  });

  it("keeps the last good path when a re-read fails", async () => {
    const fetchPath = vi.spyOn(onboardingService, "fetchPath").mockResolvedValue(pathNamed("a"));
    const { result } = renderHook(() => useOnboardingPath());
    await waitFor(() => expect(result.current.path?.id).toBe("a"));

    fetchPath.mockRejectedValue(new ApiError(500, "flaky"));
    act(() => announceBuddyPathChanged());
    await waitFor(() => expect(fetchPath).toHaveBeenCalledTimes(2));
    await Promise.resolve();

    expect(result.current.path?.id).toBe("a");
    expect(result.current.settled).toBe(true);
  });

  it("does not settle on a failed first read", async () => {
    const fetchPath = vi
      .spyOn(onboardingService, "fetchPath")
      .mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useOnboardingPath());
    await waitFor(() => expect(fetchPath).toHaveBeenCalled());
    await Promise.resolve();

    expect(result.current.settled).toBe(false);
  });

  it("lets only the newest read land", async () => {
    let answerOld: (path: OnboardingPathEndpoint) => void = () => {};
    const fetchPath = vi
      .spyOn(onboardingService, "fetchPath")
      .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
      .mockResolvedValueOnce(pathNamed("new"));
    const { result } = renderHook(() => useOnboardingPath());

    act(() => announceBuddyPathChanged());
    await waitFor(() => expect(result.current.path?.id).toBe("new"));
    act(() => answerOld(pathNamed("old")));
    await act(() => Promise.resolve());

    expect(fetchPath).toHaveBeenCalledTimes(2);
    expect(result.current.path?.id).toBe("new");
  });
});
