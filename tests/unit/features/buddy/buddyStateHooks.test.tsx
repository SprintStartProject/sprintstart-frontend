import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMentorTools } from "../../../../src/features/buddy/hooks/useMentorTools";
import { useMessageQueue } from "../../../../src/features/buddy/hooks/useMessageQueue";
import { useSessionStore } from "../../../../src/features/buddy/hooks/useSessionStore";
import { useTeamMode } from "../../../../src/features/buddy/hooks/useTeamMode";
import type { ProjectSelectionSlice } from "../../../../src/features/buddy/conversation/projectSelection";
import { queryKeys } from "../../../../src/services/queryKeys";
import type { BuddySessionSummary } from "../../../../src/services/buddyService";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("useMessageQueue", () => {
  it("starts empty and unpaused", () => {
    const { result } = renderHook(() => useMessageQueue());

    expect(result.current.queued).toEqual([]);
    expect(result.current.queuePaused).toBe(false);
    expect(result.current.queuedNow()).toEqual([]);
    expect(result.current.pausedNow()).toBe(false);
  });

  it("keeps the rendered queue and the one callbacks read in step", () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => result.current.commitQueued([{ id: "1", text: "hello" }]));

    expect(result.current.queued).toEqual([{ id: "1", text: "hello" }]);
    expect(result.current.queuedNow()).toEqual([{ id: "1", text: "hello" }]);
  });

  it("lets a callback see the queue before the next render", () => {
    const { result } = renderHook(() => useMessageQueue());

    let seen: unknown;
    act(() => {
      result.current.commitQueued([{ id: "1", text: "a" }]);
      seen = result.current.queuedNow();
    });

    expect(seen).toEqual([{ id: "1", text: "a" }]);
  });

  it("pauses and resumes", () => {
    const { result } = renderHook(() => useMessageQueue());

    act(() => result.current.setQueuePaused(true));
    expect(result.current.queuePaused).toBe(true);
    expect(result.current.pausedNow()).toBe(true);

    act(() => result.current.setQueuePaused(false));
    expect(result.current.queuePaused).toBe(false);
    expect(result.current.pausedNow()).toBe(false);
  });
});

describe("useMentorTools", () => {
  it("is on for somebody who never chose", async () => {
    const { result } = renderHook(() => useMentorTools("u1"));

    await waitFor(() => expect(result.current.capabilitiesEnabled).toBe(true));
    expect(result.current.capabilitiesNow()).toBe(true);
  });

  it("restores the choice the person made before", async () => {
    localStorage.setItem("buddyMentorTools:u1", "false");

    const { result } = renderHook(() => useMentorTools("u1"));

    await waitFor(() => expect(result.current.capabilitiesEnabled).toBe(false));
    expect(result.current.capabilitiesNow()).toBe(false);
  });

  it("remembers a new choice for this person only", () => {
    const { result } = renderHook(() => useMentorTools("u1"));

    act(() => result.current.setCapabilitiesEnabled(false));

    expect(result.current.capabilitiesEnabled).toBe(false);
    expect(result.current.capabilitiesNow()).toBe(false);
    expect(localStorage.getItem("buddyMentorTools:u1")).toBe("false");
    expect(localStorage.getItem("buddyMentorTools:u2")).toBeNull();
  });

  it("changes nothing in storage with nobody signed in", () => {
    const { result } = renderHook(() => useMentorTools(null));

    act(() => result.current.setCapabilitiesEnabled(false));

    expect(result.current.capabilitiesEnabled).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it("reads again when the person changes", async () => {
    localStorage.setItem("buddyMentorTools:u2", "false");
    const first: { id: string | null } = { id: "u1" };
    const { result, rerender } = renderHook(({ id }) => useMentorTools(id), {
      initialProps: first,
    });
    await waitFor(() => expect(result.current.capabilitiesEnabled).toBe(true));

    rerender({ id: "u2" });
    await waitFor(() => expect(result.current.capabilitiesEnabled).toBe(false));

    rerender({ id: null });
    await waitFor(() => expect(result.current.capabilitiesEnabled).toBe(true));
  });
});

describe("useSessionStore", () => {
  const session = (id: string): BuddySessionSummary => ({
    id,
    title: "t",
    projectId: null,
    createdAt: "2026-01-01T00:00:00Z",
  });

  function setup() {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { queryClient, ...renderHook(() => useSessionStore(), { wrapper }) };
  }

  it("starts with no conversations and none open", () => {
    const { result } = setup();

    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.sessionsNow()).toEqual([]);
    expect(result.current.currentSessionNow()).toBeNull();
  });

  it("writes the list to state, to the readable copy and to the cache the dashboard reads", () => {
    const { result, queryClient } = setup();

    act(() => result.current.applySessions([session("a")]));

    expect(result.current.sessions).toEqual([session("a")]);
    expect(result.current.sessionsNow()).toEqual([session("a")]);
    expect(queryClient.getQueryData(queryKeys.buddy.sessions())).toEqual([session("a")]);
  });

  it("keeps the open conversation in step in both places", () => {
    const { result } = setup();

    act(() => result.current.applyCurrentSession("a"));

    expect(result.current.currentSessionId).toBe("a");
    expect(result.current.currentSessionNow()).toBe("a");
  });

  it("remembers what was binned", () => {
    const { result } = setup();

    expect(result.current.isBinned("a")).toBe(false);
    act(() => result.current.markBinned("a"));

    expect(result.current.isBinned("a")).toBe(true);
    expect(result.current.isBinned("b")).toBe(false);
    expect(result.current.binnedNow().has("a")).toBe(true);
  });

  it("shares one resolution between callers that arrive while it runs", async () => {
    const { result } = setup();
    let finish: (id: string) => void = () => {};
    const resolve = vi.fn(() => new Promise<string>((done) => (finish = done)));

    let first!: Promise<string>;
    let second!: Promise<string>;
    act(() => {
      first = result.current.shareResolution(resolve);
      second = result.current.shareResolution(resolve);
    });
    finish("session-1");

    await expect(first).resolves.toBe("session-1");
    await expect(second).resolves.toBe("session-1");
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("lets the next caller resolve again once one has finished", async () => {
    const { result } = setup();
    const resolve = vi.fn(() => Promise.resolve("s"));

    await act(() => result.current.shareResolution(resolve));
    await act(() => result.current.shareResolution(resolve));

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("lets the next caller try again after a failed resolution", async () => {
    const { result } = setup();

    await act(async () => {
      await expect(
        result.current.shareResolution(() => Promise.reject(new Error("nope"))),
      ).rejects.toThrow("nope");
    });
    const next = await act(() => result.current.shareResolution(() => Promise.resolve("ok")));

    expect(next).toBe("ok");
  });
});

describe("useTeamMode", () => {
  const selection = (over: Partial<ProjectSelectionSlice> = {}): ProjectSelectionSlice => ({
    selectedProjectId: "p1",
    hasSelectedProject: true,
    canManageSelected: true,
    isLoading: false,
    setSelectedProjectId: vi.fn(),
    ...over,
  });

  function setup(initial: ProjectSelectionSlice, userId: string | null = "u1") {
    const onLeft = vi.fn();
    const view = renderHook(({ sel, id }) => useTeamMode(sel, id, onLeft), {
      initialProps: { sel: initial, id: userId },
    });

    return { onLeft, ...view };
  }

  it("is off for somebody who never turned it on", async () => {
    const { result } = setup(selection());

    await act(async () => {});
    expect(result.current.isTeamMode).toBe(false);
    expect(result.current.teamProjectId).toBeNull();
  });

  it("restores the choice and follows the project the list vouches for", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");

    const { result } = setup(selection());

    await waitFor(() => expect(result.current.isTeamMode).toBe(true));
    expect(result.current.teamProjectId).toBe("p1");
    await waitFor(() => expect(result.current.teamProjectNow()).toBe("p1"));
  });

  it("is about no project while the person cannot manage the selected one", () => {
    const { result } = setup(selection({ canManageSelected: false }));

    act(() => result.current.setTeamMode(true));

    expect(result.current.isTeamMode).toBe(true);
    expect(result.current.teamProjectId).toBeNull();
  });

  it("remembers the choice per person and forgets it when turned off", () => {
    const { result } = setup(selection());

    act(() => result.current.setTeamMode(true));
    expect(localStorage.getItem("buddyTeamMode:u1")).toBe("true");

    act(() => result.current.setTeamMode(false));
    expect(localStorage.getItem("buddyTeamMode:u1")).toBe("false");
  });

  it("ends audibly when a restored preference finds nothing it can manage", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");

    const { result, onLeft } = setup(selection({ canManageSelected: false }));

    await waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(result.current.isTeamMode).toBe(false);
  });

  it("waits for the project list before judging", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");

    const { result, onLeft, rerender } = setup(
      selection({ isLoading: true, hasSelectedProject: false }),
    );
    await act(async () => {});
    expect(onLeft).not.toHaveBeenCalled();
    expect(result.current.isTeamMode).toBe(true);

    rerender({ sel: selection(), id: "u1" });
    await act(async () => {});
    expect(onLeft).not.toHaveBeenCalled();
    expect(result.current.isTeamMode).toBe(true);
  });

  it("ends audibly when the selection moves to another project", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");
    const { result, onLeft, rerender } = setup(selection());
    await waitFor(() => expect(result.current.teamProjectId).toBe("p1"));
    await act(async () => {});

    rerender({ sel: selection({ selectedProjectId: "p2" }), id: "u1" });

    await waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(result.current.isTeamMode).toBe(false);
  });

  it("ends audibly when management of the project is lost", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");
    const { result, onLeft, rerender } = setup(selection());
    await waitFor(() => expect(result.current.teamProjectId).toBe("p1"));
    await act(async () => {});

    rerender({ sel: selection({ canManageSelected: false }), id: "u1" });

    await waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(result.current.isTeamMode).toBe(false);
  });

  it("stays out of the way of a voluntary switch to another project", async () => {
    localStorage.setItem("buddyTeamMode:u1", "true");
    const { result, onLeft, rerender } = setup(selection());
    await waitFor(() => expect(result.current.teamProjectId).toBe("p1"));
    await act(async () => {});

    act(() => result.current.bindTeamTarget("p2"));
    rerender({ sel: selection({ selectedProjectId: "p2" }), id: "u1" });
    await act(async () => {});

    expect(onLeft).not.toHaveBeenCalled();
    expect(result.current.isTeamMode).toBe(true);
    expect(result.current.teamProjectId).toBe("p2");
  });

  it("lets the thread on screen follow a project ahead of the effect", () => {
    const { result } = setup(selection());

    act(() => result.current.adoptTeamProject("p9"));

    expect(result.current.teamProjectNow()).toBe("p9");
  });

  it("reads again when the person changes", async () => {
    localStorage.setItem("buddyTeamMode:u2", "true");
    const { result, rerender } = setup(selection(), "u1");
    await act(async () => {});
    expect(result.current.isTeamMode).toBe(false);

    rerender({ sel: selection(), id: "u2" });

    await waitFor(() => expect(result.current.isTeamMode).toBe(true));
  });
});
