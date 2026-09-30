import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MIN_REFRESH_INTERVAL_MS,
  usePmAttentionCount,
} from "../../../../src/features/team-management/usePmAttentionCount";

// The emitter is kept real: the point of these tests is that acting on an item
// updates the badge without waiting for the rate limit.
const attentionListeners = new Set<() => void>();

vi.mock("../../../../src/services/teamManagementService", () => ({
  getPmAttentionCount: vi.fn(),
  onPmAttentionChanged: (listener: () => void) => {
    attentionListeners.add(listener);
    return () => attentionListeners.delete(listener);
  },
}));

function emitAttentionChanged() {
  attentionListeners.forEach((listener) => {
    listener();
  });
}

import { getPmAttentionCount } from "../../../../src/services/teamManagementService";

const count = (pendingSkips: number, unreadFeedback: number) => ({
  pendingSkips,
  unreadFeedback,
  total: pendingSkips + unreadFeedback,
});

describe("usePmAttentionCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attentionListeners.clear();
  });

  it("returns the count the service reads", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(2, 3));

    const { result } = renderHook(() => usePmAttentionCount("proj1", true));

    await waitFor(() => expect(result.current).toEqual(count(2, 3)));
    expect(getPmAttentionCount).toHaveBeenCalledWith("proj1");
  });

  it("has no count while the first read is still in flight", () => {
    vi.mocked(getPmAttentionCount).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePmAttentionCount("proj1", true));

    expect(result.current).toBeNull();
  });

  it("does not fetch at all for someone without dashboard access", () => {
    renderHook(() => usePmAttentionCount("proj1", false));

    expect(getPmAttentionCount).not.toHaveBeenCalled();
  });

  it("does not fetch while no project is selected", () => {
    renderHook(() => usePmAttentionCount(null, true));

    expect(getPmAttentionCount).not.toHaveBeenCalled();
  });

  it("refetches when the project changes", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));

    const { rerender } = renderHook(({ projectId }) => usePmAttentionCount(projectId, true), {
      initialProps: { projectId: "proj1" },
    });

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(2));
    expect(vi.mocked(getPmAttentionCount).mock.calls[1][0]).toBe("proj2");
  });

  // Regression: the rate limit used to claim its slot before the request
  // landed. StrictMode discards the first effect's result, and the re-run
  // then found itself rate limited, so the flag never showed up in dev.
  it("still resolves under StrictMode double-invocation", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 1));

    const { result } = renderHook(() => usePmAttentionCount("proj1", true, "/pm-dashboard"), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current).toEqual(count(0, 1)));
  });

  it("rechecks when the view changes", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { rerender } = renderHook(({ route }) => usePmAttentionCount("proj1", true, route), {
        initialProps: { route: "/pm-dashboard" },
      });

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

      // Past the rate limit, so a new view is allowed to ask again.
      vi.advanceTimersByTime(MIN_REFRESH_INTERVAL_MS + 1000);
      rerender({ route: "/team" });

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not refetch on rapid navigation within the rate limit", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));

    const { rerender } = renderHook(({ route }) => usePmAttentionCount("proj1", true, route), {
      initialProps: { route: "/pm-dashboard" },
    });

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

    rerender({ route: "/team" });
    rerender({ route: "/knowledge-base" });
    rerender({ route: "/chat" });

    expect(getPmAttentionCount).toHaveBeenCalledTimes(1);
  });

  it("always refetches on a project switch, rate limit or not", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));

    const { rerender } = renderHook(
      ({ projectId }) => usePmAttentionCount(projectId, true, "/pm-dashboard"),
      { initialProps: { projectId: "proj1" } },
    );

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(2));
  });

  it("rechecks when the tab regains focus", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() => usePmAttentionCount("proj1", true, "/pm-dashboard"));

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

      vi.advanceTimersByTime(MIN_REFRESH_INTERVAL_MS + 500);
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not recheck on focus while inside the rate limit", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));

    renderHook(() => usePmAttentionCount("proj1", true, "/pm-dashboard"));

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(getPmAttentionCount).toHaveBeenCalledTimes(1);
  });

  it("updates immediately once an item has been handled", async () => {
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 1));

    const { result } = renderHook(() => usePmAttentionCount("proj1", true, "/pm-dashboard"));

    await waitFor(() => expect(result.current).toEqual(count(0, 1)));

    // The user reads the feedback; the service announces it. This must not
    // wait out the rate limit, even though the last check was just now.
    vi.mocked(getPmAttentionCount).mockResolvedValue(count(0, 0));
    act(() => {
      emitAttentionChanged();
    });

    await waitFor(() => expect(result.current).toEqual(count(0, 0)));
    expect(getPmAttentionCount).toHaveBeenCalledTimes(2);
  });

  it("has no count, rather than zero, when the request fails", async () => {
    vi.mocked(getPmAttentionCount).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePmAttentionCount("proj1", true));

    await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
