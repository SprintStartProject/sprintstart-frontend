import { describe, expect, it, vi } from "vitest";
import { createTurnTracker } from "../../../../src/features/buddy/conversation/turnTracker";

describe("createTurnTracker", () => {
  it("starts idle", () => {
    const tracker = createTurnTracker();

    expect(tracker.isStreaming()).toBe(false);
    expect(tracker.hasRunningHandle()).toBe(false);
    expect(tracker.sendCount()).toBe(0);
  });

  it("claims the slot on begin, in the same tick, and counts the send", () => {
    const tracker = createTurnTracker();

    const controller = tracker.begin();

    expect(controller.signal.aborted).toBe(false);
    expect(tracker.isStreaming()).toBe(true);
    expect(tracker.hasRunningHandle()).toBe(true);
    expect(tracker.sendCount()).toBe(1);
    tracker.begin();
    expect(tracker.sendCount()).toBe(2);
  });

  it("aborts the running handle and nothing else", () => {
    const tracker = createTurnTracker();
    expect(() => tracker.abort()).not.toThrow();

    const controller = tracker.begin();
    tracker.abort();

    expect(controller.signal.aborted).toBe(true);
  });

  it("releases the slot on end and lets the drain go next", () => {
    const tracker = createTurnTracker();
    const drain = vi.fn();
    tracker.onEnd(drain);
    const controller = tracker.begin();

    tracker.end(controller);

    expect(tracker.isStreaming()).toBe(false);
    expect(tracker.hasRunningHandle()).toBe(false);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it("keeps a newer turn's handle when an older turn ends", () => {
    const tracker = createTurnTracker();
    const older = tracker.begin();
    const newer = tracker.begin();

    tracker.end(older);

    expect(tracker.hasRunningHandle()).toBe(true);
    tracker.abort();
    expect(newer.signal.aborted).toBe(true);
    expect(older.signal.aborted).toBe(false);
  });

  it("waits for the tracked turn and clears it once it settles", async () => {
    const tracker = createTurnTracker();
    let release = () => {};
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    tracker.track(turn);
    let settled = false;
    const waiting = tracker.settled().then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await waiting;
    expect(settled).toBe(true);
  });

  it("does not reject when the tracked turn fails", async () => {
    const tracker = createTurnTracker();
    const turn = Promise.reject(new Error("boom"));
    tracker.track(turn);

    await expect(tracker.settled()).resolves.toBeUndefined();
  });

  it("only the latest tracked turn clears the slot", async () => {
    const tracker = createTurnTracker();
    let releaseFirst = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let releaseSecond = () => {};
    const second = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    tracker.track(first);
    tracker.track(second);

    releaseFirst();
    await first;
    let settled = false;
    void tracker.settled().then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    releaseSecond();
    await second;
    await tracker.settled();
    expect(settled).toBe(true);
  });
});
