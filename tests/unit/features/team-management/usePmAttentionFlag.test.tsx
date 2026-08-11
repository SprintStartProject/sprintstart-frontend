import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MIN_REFRESH_INTERVAL_MS,
  usePmAttentionFlag,
} from "../../../../src/features/team-management/usePmAttentionFlag";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

// The emitter is kept real: the point of these tests is that acting on an item
// clears the badge without waiting for the rate limit.
const attentionListeners = new Set<() => void>();

vi.mock("../../../../src/services/teamManagementService", () => ({
  getTeamOverview: vi.fn(),
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

import { getTeamOverview } from "../../../../src/services/teamManagementService";

function user(overrides: Partial<TeamOverviewUser>): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "A",
    lastname: "B",
    username: "ab",
    roles: [],
    progress: { completed: 0, total: 1 },
    currentPhase: null,
    currentStep: null,
    hasFeedback: false,
    ...overrides,
  } as TeamOverviewUser;
}

const pendingSkip = user({
  userId: "u2",
  currentStep: {
    id: "s1",
    title: "Step",
    startedAt: new Date().toISOString(),
    skip: {
      id: "skip1",
      stepId: "s1",
      reason: "because",
      status: "PENDING",
      reviewComment: null,
      reviewedAt: null,
    },
  },
});

describe("usePmAttentionFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attentionListeners.clear();
  });

  it("flags a pending skip request", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([user({}), pendingSkip]);

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("flags unread feedback", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([user({ hasFeedback: true })]);

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays quiet when every skip request is already decided", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([
      user({
        currentStep: {
          id: "s1",
          title: "Step",
          startedAt: new Date().toISOString(),
          skip: {
            id: "skip1",
            stepId: "s1",
            reason: "because",
            status: "ACCEPTED",
            reviewComment: null,
            reviewedAt: new Date().toISOString(),
          },
        },
      }),
    ]);

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true));

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("does not fetch at all for someone without dashboard access", () => {
    renderHook(() => usePmAttentionFlag("proj1", false));

    expect(getTeamOverview).not.toHaveBeenCalled();
  });

  it("does not fetch while no project is selected", () => {
    renderHook(() => usePmAttentionFlag(null, true));

    expect(getTeamOverview).not.toHaveBeenCalled();
  });

  it("refetches when the project changes", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);

    const { rerender } = renderHook(({ projectId }) => usePmAttentionFlag(projectId, true), {
      initialProps: { projectId: "proj1" },
    });

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(2));
    expect(vi.mocked(getTeamOverview).mock.calls[1][2]).toEqual(["proj2"]);
  });

  // Regression: the rate limit used to claim its slot before the request
  // landed. StrictMode discards the first effect's result, and the re-run
  // then found itself rate limited, so the flag never showed up in dev.
  it("still resolves under StrictMode double-invocation", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([user({ hasFeedback: true })]);

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true, "/pm-dashboard"), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("rechecks when the view changes", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const { rerender } = renderHook(({ route }) => usePmAttentionFlag("proj1", true, route), {
        initialProps: { route: "/pm-dashboard" },
      });

      await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

      // Past the rate limit, so a new view is allowed to ask again.
      vi.advanceTimersByTime(MIN_REFRESH_INTERVAL_MS + 1000);
      rerender({ route: "/team" });

      await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not refetch on rapid navigation within the rate limit", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);

    const { rerender } = renderHook(({ route }) => usePmAttentionFlag("proj1", true, route), {
      initialProps: { route: "/pm-dashboard" },
    });

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

    rerender({ route: "/team" });
    rerender({ route: "/knowledge-base" });
    rerender({ route: "/chat" });

    expect(getTeamOverview).toHaveBeenCalledTimes(1);
  });

  it("always refetches on a project switch, rate limit or not", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ projectId }) => usePmAttentionFlag(projectId, true, "/pm-dashboard"),
      { initialProps: { projectId: "proj1" } },
    );

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(2));
  });

  it("rechecks when the tab regains focus", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderHook(() => usePmAttentionFlag("proj1", true, "/pm-dashboard"));

      await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

      vi.advanceTimersByTime(MIN_REFRESH_INTERVAL_MS + 500);
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not recheck on focus while inside the rate limit", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([]);

    renderHook(() => usePmAttentionFlag("proj1", true, "/pm-dashboard"));

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(getTeamOverview).toHaveBeenCalledTimes(1);
  });

  it("clears immediately once the item has been handled", async () => {
    vi.mocked(getTeamOverview).mockResolvedValue([user({ hasFeedback: true })]);

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true, "/pm-dashboard"));

    await waitFor(() => expect(result.current).toBe(true));

    // The user reads the feedback; the service announces it. This must not
    // wait out the rate limit, even though the last check was just now.
    vi.mocked(getTeamOverview).mockResolvedValue([user({ hasFeedback: false })]);
    act(() => {
      emitAttentionChanged();
    });

    await waitFor(() => expect(result.current).toBe(false));
    expect(getTeamOverview).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the request fails", async () => {
    vi.mocked(getTeamOverview).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePmAttentionFlag("proj1", true));

    await waitFor(() => expect(getTeamOverview).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
