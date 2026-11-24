import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQueueControls } from "../../../../src/features/buddy/hooks/useQueueControls";
import { useMessageQueue } from "../../../../src/features/buddy/hooks/useMessageQueue";
import { useTargetSwitch } from "../../../../src/features/buddy/hooks/useTargetSwitch";
import { createTurnTracker } from "../../../../src/features/buddy/conversation/turnTracker";
import { createOpeningLatches } from "../../../../src/features/buddy/conversation/openingLatches";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

function queueHarness(messages: BuddyMessageView[] = []) {
  const tracker = createTurnTracker();
  const sendMessage = vi.fn(() => Promise.resolve());
  const hook = renderHook(() => {
    const queue = useMessageQueue();
    const controls = useQueueControls({
      tracker,
      sendMessage,
      messagesNow: () => messages,
      commitQueued: queue.commitQueued,
      setQueuePaused: queue.setQueuePaused,
      queuedNow: queue.queuedNow,
      pausedNow: queue.pausedNow,
    });
    return { queue, controls };
  });
  return { tracker, sendMessage, hook };
}

describe("useQueueControls", () => {
  it("sends straight away when idle, and ignores blank text", () => {
    const { sendMessage, hook } = queueHarness();

    act(() => hook.result.current.controls.submitMessage("  "));
    act(() => hook.result.current.controls.submitMessage("hello"));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("hello");
  });

  it("queues behind a running turn, and sending releases a held queue", () => {
    const { tracker, sendMessage, hook } = queueHarness();
    tracker.begin();
    act(() => hook.result.current.queue.setQueuePaused(true));

    act(() => hook.result.current.controls.submitMessage("later"));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(hook.result.current.queue.queued.map((item) => item.text)).toEqual(["later"]);
    expect(hook.result.current.queue.queuePaused).toBe(false);
  });

  it("starts the oldest queued message when a turn ends, unless Stop holds the queue", () => {
    const { tracker, sendMessage, hook } = queueHarness();
    const first = tracker.begin();
    act(() => hook.result.current.controls.submitMessage("one"));
    act(() => hook.result.current.controls.submitMessage("two"));

    act(() => tracker.end(first));

    expect(sendMessage).toHaveBeenCalledWith("one");
    expect(hook.result.current.queue.queued.map((item) => item.text)).toEqual(["two"]);

    act(() => hook.result.current.queue.setQueuePaused(true));
    act(() => tracker.end(tracker.begin()));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("removes and pulls queued messages", () => {
    const { tracker, hook } = queueHarness();
    tracker.begin();
    act(() => hook.result.current.controls.submitMessage("one"));
    act(() => hook.result.current.controls.submitMessage("two"));
    const [one, two] = hook.result.current.queue.queued;

    act(() => hook.result.current.controls.removeQueued(one.id));
    expect(hook.result.current.queue.queued.map((item) => item.text)).toEqual(["two"]);

    let pulled: string | null = null;
    act(() => {
      pulled = hook.result.current.controls.pullQueuedMessage(two.id);
    });
    expect(pulled).toBe("two");
    expect(hook.result.current.queue.queued).toEqual([]);
    act(() => {
      pulled = hook.result.current.controls.pullQueuedMessage("missing");
    });
    expect(pulled).toBeNull();
  });

  it("resumes a held queue from the oldest, or only lifts the hold while a turn runs", () => {
    const { tracker, sendMessage, hook } = queueHarness();
    const running = tracker.begin();
    act(() => hook.result.current.controls.submitMessage("one"));
    act(() => hook.result.current.queue.setQueuePaused(true));

    act(() => hook.result.current.controls.resumeQueue());
    expect(hook.result.current.queue.queuePaused).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => tracker.end(running));
    expect(sendMessage).toHaveBeenCalledWith("one");

    act(() => hook.result.current.controls.submitMessage("two"));
    act(() => hook.result.current.queue.setQueuePaused(true));
    act(() => hook.result.current.controls.resumeQueue());
    expect(sendMessage).toHaveBeenCalledWith("two");
  });

  it("re-asks the question a reply was answering, and nothing for the greeting", () => {
    const thread: BuddyMessageView[] = [
      { id: "g", role: "ASSISTANT", content: "hi", createdAt: "x" },
      { id: "q", role: "USER", content: "why?", createdAt: "x" },
      { id: "a", role: "ASSISTANT", content: "", createdAt: "x" },
    ];
    const { sendMessage, hook } = queueHarness(thread);

    act(() => hook.result.current.controls.retryReply("g"));
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => hook.result.current.controls.retryReply("a"));
    expect(sendMessage).toHaveBeenCalledWith("why?");
  });
});

function targetHarness(over: {
  busy?: boolean;
  deciding?: boolean;
  teamProjectId?: string | null;
}) {
  const calls = {
    adopted: [] as (string | null)[],
    cleared: 0,
    thinking: [] as boolean[],
    streaming: [] as boolean[],
    opened: 0,
    teamMode: [] as boolean[],
    bound: [] as string[],
    selected: [] as string[],
  };
  const latches = createOpeningLatches();
  latches.claimLoad();
  const props = {
    teamProjectId: over.teamProjectId ?? null,
    busy: over.busy ?? false,
    deciding: over.deciding ?? false,
  };
  const hook = renderHook(
    (current: typeof props) =>
      useTargetSwitch({
        teamProjectId: current.teamProjectId,
        adoptTeamProject: (id) => calls.adopted.push(id),
        setTeamMode: (on) => calls.teamMode.push(on),
        bindTeamTarget: (id) => calls.bound.push(id),
        busy: current.busy,
        decidingNow: () => current.deciding,
        selection: {
          selectedProjectId: null,
          setSelectedProjectId: (id: string) => calls.selected.push(id),
        } as never,
        latches,
        clearThread: () => {
          calls.cleared += 1;
        },
        setIsThinking: (next) => calls.thinking.push(next as boolean),
        setIsStreaming: (next) => calls.streaming.push(next as boolean),
        ensureOpened: () => {
          calls.opened += 1;
          return Promise.resolve();
        },
      }),
    { initialProps: props },
  );
  return { calls, hook, latches, props };
}

describe("useTargetSwitch", () => {
  it("does nothing while the target is still the hire's own", async () => {
    const { calls } = targetHarness({});
    await act(() => Promise.resolve());

    expect(calls.adopted).toEqual([]);
    expect(calls.cleared).toBe(0);
  });

  it("clears the thread, releases the load latch and reopens when the target moves", async () => {
    const { calls, hook, latches, props } = targetHarness({});

    hook.rerender({ ...props, teamProjectId: "p1" });
    await act(() => Promise.resolve());

    expect(calls.adopted).toEqual(["p1"]);
    expect(calls.cleared).toBe(1);
    expect(calls.thinking).toEqual([false]);
    expect(calls.streaming).toEqual([false]);
    expect(calls.opened).toBe(1);
    expect(latches.claimLoad()).toBe(true);
  });

  it("applies one move once, however often it re-renders", async () => {
    const { calls, hook, props } = targetHarness({});

    hook.rerender({ ...props, teamProjectId: "p1" });
    hook.rerender({ ...props, teamProjectId: "p1" });
    await act(() => Promise.resolve());

    expect(calls.adopted).toEqual(["p1"]);
  });

  it("waits while a turn is in flight and applies when it ends", async () => {
    const { calls, hook, props } = targetHarness({});

    hook.rerender({ ...props, teamProjectId: "p1", busy: true });
    await act(() => Promise.resolve());
    expect(calls.adopted).toEqual([]);

    hook.rerender({ ...props, teamProjectId: "p1", busy: false });
    await act(() => Promise.resolve());
    expect(calls.adopted).toEqual(["p1"]);
  });

  it("waits while a decision is in flight", async () => {
    const { calls, hook, props } = targetHarness({});

    hook.rerender({ ...props, teamProjectId: "p1", deciding: true });
    await act(() => Promise.resolve());

    expect(calls.adopted).toEqual([]);
  });

  it("switches to a project by selecting it, binding the target and entering team mode", () => {
    const { calls, hook } = targetHarness({});

    act(() => hook.result.current.switchTeamProject("p2"));

    expect(calls.selected).toEqual(["p2"]);
    expect(calls.bound).toEqual(["p2"]);
    expect(calls.teamMode).toEqual([true]);
  });

  it("leaves team mode for null without touching the selection", () => {
    const { calls, hook } = targetHarness({});

    act(() => hook.result.current.switchTeamProject(null));

    expect(calls.teamMode).toEqual([false]);
    expect(calls.selected).toEqual([]);
  });

  it.each([
    ["a turn is in flight", { busy: true }],
    ["a decision is in flight", { deciding: true }],
  ])("refuses to switch while %s", (_name, over) => {
    const { calls, hook } = targetHarness(over);

    act(() => hook.result.current.switchTeamProject("p2"));
    act(() => hook.result.current.switchTeamProject(null));

    expect(calls.teamMode).toEqual([]);
    expect(calls.selected).toEqual([]);
  });
});
