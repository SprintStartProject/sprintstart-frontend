import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOpenEscalationCount } from "../../../../src/features/knowledge-request/useOpenEscalationCount";

// The emitter is kept real, like the PM attention flag's own suite: the point of
// several of these is that acting on the queue updates the badge without waiting
// for the rate limit or for a navigation.
const escalationListeners = new Set<() => void>();

vi.mock("../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { countOpen: vi.fn() },
  onOpenEscalationsChanged: (listener: () => void) => {
    escalationListeners.add(listener);
    return () => escalationListeners.delete(listener);
  },
}));

function emitEscalationsChanged() {
  escalationListeners.forEach((listener) => {
    listener();
  });
}

import { knowledgeRequestService } from "../../../../src/services/knowledgeRequestService";

describe("useOpenEscalationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    escalationListeners.clear();
  });

  it("counts the questions still waiting on a person", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(2);

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(result.current).toBe(2));
  });

  // Its own endpoint, not `listOpen(...).length`: the full read resolves every
  // asker's name and onboarding position to produce one integer. The mock above
  // exposes `countOpen` alone, so reaching for the queue would throw here.
  it("counts through the count endpoint, scoped to the project", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(2);

    renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalledWith("proj1"));
  });

  it("reports nothing for an inbox that is clear", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });

  it("does not read at all for somebody who cannot open the inbox", () => {
    renderHook(() => useOpenEscalationCount("proj1", false));

    expect(knowledgeRequestService.countOpen).not.toHaveBeenCalled();
  });

  it("does not read while no project is selected", () => {
    renderHook(() => useOpenEscalationCount(null, true));

    expect(knowledgeRequestService.countOpen).not.toHaveBeenCalled();
  });

  // A badge is not worth surfacing an error for, and a number nobody can trust
  // is worse than no number: a failed read leaves the entry unmarked.
  it("stays quiet when the read fails", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });

  it("re-reads on a project switch, so the badge belongs to the project on screen", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(1);

    const { rerender } = renderHook(({ projectId }) => useOpenEscalationCount(projectId, true), {
      initialProps: { projectId: "proj1" },
    });

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalledTimes(2));
    expect(vi.mocked(knowledgeRequestService.countOpen).mock.calls[1][0]).toBe("proj2");
  });

  /**
   * The previous project's number used to stay on screen for the duration of the
   * new project's read. Invisible as the boolean dot this machinery was written
   * for; as a count it is a confident wrong answer about the wrong project.
   */
  it("shows no number at all while the new project's count is in flight", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(7);

    const { result, rerender } = renderHook(
      ({ projectId }) => useOpenEscalationCount(projectId, true),
      { initialProps: { projectId: "proj1" } },
    );

    await waitFor(() => expect(result.current).toBe(7));

    let release: (value: number) => void = () => {};
    vi.mocked(knowledgeRequestService.countOpen).mockReturnValue(
      new Promise<number>((resolve) => {
        release = resolve;
      }),
    );

    rerender({ projectId: "proj2" });

    expect(result.current).toBe(0);

    act(() => {
      release(2);
    });

    await waitFor(() => expect(result.current).toBe(2));
  });

  /**
   * The PM who empties the queue is looking at this badge while they do it, and
   * they can answer every question without ever leaving the inbox — so a badge
   * that only refreshes on navigation sits there contradicting the list below it.
   */
  it("re-reads at once when the queue changes under the PM's own hands", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(5);

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(result.current).toBe(5));

    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(4);
    act(() => {
      emitEscalationsChanged();
    });

    await waitFor(() => expect(result.current).toBe(4));
  });

  it("does not re-read on rapid navigation within the rate limit", async () => {
    vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);

    const { rerender } = renderHook(({ route }) => useOpenEscalationCount("proj1", true, route), {
      initialProps: { route: "/pm-dashboard" },
    });

    await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalledTimes(1));

    rerender({ route: "/team" });
    rerender({ route: "/chat" });

    expect(knowledgeRequestService.countOpen).toHaveBeenCalledTimes(1);
  });
});
