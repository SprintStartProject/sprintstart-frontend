import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraftBuffer,
  createWatchdog,
} from "../../../../src/features/buddy/conversation/turnTimers";
import {
  changesBoard,
  placesOnBoard,
} from "../../../../src/features/buddy/conversation/boardActions";
import { isNotFound } from "../../../../src/features/buddy/conversation/replyMessages";
import {
  readStoredMentorTools,
  readStoredTeamMode,
  writeStoredMentorTools,
  writeStoredTeamMode,
} from "../../../../src/features/buddy/conversation/buddyPreferences";

describe("createWatchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("goes off after the silence it was armed for", () => {
    const onTimeout = vi.fn();
    const watchdog = createWatchdog(1000, onTimeout);

    watchdog.arm();
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("is pushed back every time it is armed again", () => {
    const onTimeout = vi.fn();
    const watchdog = createWatchdog(1000, onTimeout);

    watchdog.arm();
    vi.advanceTimersByTime(800);
    watchdog.arm();
    vi.advanceTimersByTime(800);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("never goes off once cleared, and clearing twice is harmless", () => {
    const onTimeout = vi.fn();
    const watchdog = createWatchdog(1000, onTimeout);

    watchdog.arm();
    watchdog.clear();
    watchdog.clear();
    vi.advanceTimersByTime(5000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("can be armed again after it has been cleared", () => {
    const onTimeout = vi.fn();
    const watchdog = createWatchdog(1000, onTimeout);

    watchdog.arm();
    watchdog.clear();
    watchdog.arm();
    vi.advanceTimersByTime(1000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

describe("createDraftBuffer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hands over everything gathered, in one go, when flushed", () => {
    const apply = vi.fn();
    const draft = createDraftBuffer(apply);

    draft.addContent("he");
    draft.addContent("llo");
    draft.addReasoning("think");
    draft.flush();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ content: "hello", reasoning: "think" });
  });

  it("hands over nothing when nothing is waiting", () => {
    const apply = vi.fn();

    createDraftBuffer(apply).flush();

    expect(apply).not.toHaveBeenCalled();
  });

  it("starts empty again after a flush", () => {
    const apply = vi.fn();
    const draft = createDraftBuffer(apply);

    draft.addContent("a");
    draft.flush();
    draft.addContent("b");
    draft.flush();

    expect(apply).toHaveBeenNthCalledWith(2, { content: "b", reasoning: "" });
  });

  it("hands over once per frame, however many tokens arrived", async () => {
    const apply = vi.fn();
    const draft = createDraftBuffer(apply);

    draft.addContent("a");
    draft.schedule();
    draft.addContent("b");
    draft.schedule();
    expect(apply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ content: "ab", reasoning: "" });
  });

  it("cancels the pending frame when flushed first", async () => {
    const apply = vi.fn();
    const draft = createDraftBuffer(apply);

    draft.addContent("a");
    draft.schedule();
    draft.flush();
    await vi.advanceTimersByTimeAsync(20);

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("can throw away the words and still hand over the thoughts", () => {
    const apply = vi.fn();
    const draft = createDraftBuffer(apply);

    draft.addContent("words");
    draft.addReasoning("thoughts");
    draft.discardContent();
    draft.flush();

    expect(apply).toHaveBeenCalledWith({ content: "", reasoning: "thoughts" });
  });
});

describe("board actions", () => {
  it("knows which confirmed actions change the board", () => {
    expect(changesBoard("place_note")).toBe(true);
    expect(changesBoard("claim_goal")).toBe(true);
    expect(changesBoard("flag_to_pm")).toBe(false);
  });

  it("knows which tool places a card while it runs", () => {
    expect(placesOnBoard("place_card")).toBe(true);
    expect(placesOnBoard("search")).toBe(false);
  });
});

describe("isNotFound", () => {
  it("is true only for an error carrying status 404", () => {
    const withStatus = (status: number) => Object.assign(new Error("x"), { status });

    expect(isNotFound(withStatus(404))).toBe(true);
    expect(isNotFound(withStatus(500))).toBe(false);
    expect(isNotFound(new Error("x"))).toBe(false);
    expect(isNotFound({ status: 404 })).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("remembered preferences", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("starts team mode off and mentor tools on", () => {
    expect(readStoredTeamMode("u1")).toBe(false);
    expect(readStoredMentorTools("u1")).toBe(true);
  });

  it("remembers each choice per person", () => {
    writeStoredTeamMode("u1", true);
    writeStoredMentorTools("u1", false);

    expect(readStoredTeamMode("u1")).toBe(true);
    expect(readStoredTeamMode("u2")).toBe(false);
    expect(readStoredMentorTools("u1")).toBe(false);
    expect(readStoredMentorTools("u2")).toBe(true);
  });

  it("remembers turning them back", () => {
    writeStoredTeamMode("u1", true);
    writeStoredTeamMode("u1", false);
    writeStoredMentorTools("u1", false);
    writeStoredMentorTools("u1", true);

    expect(readStoredTeamMode("u1")).toBe(false);
    expect(readStoredMentorTools("u1")).toBe(true);
  });

  it("falls back to the defaults when storage refuses", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(readStoredTeamMode("u1")).toBe(false);
    expect(readStoredMentorTools("u1")).toBe(true);
    expect(() => writeStoredTeamMode("u1", true)).not.toThrow();
    expect(() => writeStoredMentorTools("u1", false)).not.toThrow();
  });
});
