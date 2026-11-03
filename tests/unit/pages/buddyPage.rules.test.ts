import { afterEach, describe, expect, it, vi } from "vitest";
import { decideAddress, type AddressInput } from "../../../src/pages/buddyPage/decideAddress";
import {
  readRailOpen,
  readSeenReplyIds,
  writeRailOpen,
  writeSeenReplyIds,
} from "../../../src/pages/buddyPage/railPreference";

function input(over: Partial<AddressInput> = {}): AddressInput {
  return {
    urlSessionId: undefined,
    previousSessionId: "a",
    currentSessionId: "a",
    knownSessionIds: ["a", "b"],
    refreshedFor: null,
    isSettling: false,
    cannotSwitch: false,
    ...over,
  };
}

describe("decideAddress — an explicit address", () => {
  it("opens a known conversation the address names", () => {
    expect(decideAddress(input({ urlSessionId: "b" }))).toEqual({ kind: "select", target: "b" });
  });

  it("waits while the list is empty or the first open is still settling", () => {
    expect(decideAddress(input({ urlSessionId: "b", knownSessionIds: [] }))).toEqual({
      kind: "none",
    });
    expect(decideAddress(input({ urlSessionId: "b", isSettling: true }))).toEqual({ kind: "none" });
  });

  it("re-reads the list once for an address it does not know", () => {
    expect(decideAddress(input({ urlSessionId: "zzz" }))).toEqual({
      kind: "refresh",
      target: "zzz",
    });
  });

  it("does not start a second re-read while one answers the same address", () => {
    expect(decideAddress(input({ urlSessionId: "zzz", refreshedFor: "zzz" }))).toEqual({
      kind: "none",
    });
    expect(decideAddress(input({ urlSessionId: "zzz", refreshedFor: "other" }))).toEqual({
      kind: "refresh",
      target: "zzz",
    });
  });

  it("puts the address back when it cannot be followed now", () => {
    expect(decideAddress(input({ urlSessionId: "b", cannotSwitch: true }))).toEqual({
      kind: "revert",
    });
  });

  it("does not count the address as explicit when it names where we are or just were", () => {
    expect(decideAddress(input({ urlSessionId: "a", currentSessionId: "a" }))).toEqual({
      kind: "none",
    });
    expect(
      decideAddress(
        input({ urlSessionId: "old", previousSessionId: "old", currentSessionId: "b" }),
      ),
    ).toEqual({ kind: "follow", sessionId: "b" });
  });
});

describe("decideAddress — following the conversation", () => {
  it("leaves the first resolve alone, so the bare page keeps its bare address", () => {
    expect(decideAddress(input({ previousSessionId: null }))).toEqual({ kind: "none" });
  });

  it("does nothing without a conversation on screen", () => {
    expect(decideAddress(input({ currentSessionId: null }))).toEqual({ kind: "none" });
  });

  it("does nothing when the address already names the conversation", () => {
    expect(decideAddress(input({ urlSessionId: "b", currentSessionId: "b" }))).toEqual({
      kind: "none",
    });
  });

  it("gives the address the new conversation when the bare page changed conversation", () => {
    expect(decideAddress(input({ currentSessionId: "b" }))).toEqual({
      kind: "follow",
      sessionId: "b",
    });
  });

  it("does not drag an address along that names neither old nor new", () => {
    expect(
      decideAddress(input({ urlSessionId: "x", currentSessionId: "b", knownSessionIds: [] })),
    ).toEqual({
      kind: "none",
    });
  });
});

describe("rail preference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is unset until the hire has chosen", () => {
    expect(readRailOpen()).toBeNull();
  });

  it("remembers either choice", () => {
    writeRailOpen(true);
    expect(readRailOpen()).toBe(true);
    writeRailOpen(false);
    expect(readRailOpen()).toBe(false);
  });

  it("reads a choice made under the pre-rename key", () => {
    localStorage.setItem("buddyPmRepliesOpen", "true");
    expect(readRailOpen()).toBe(true);
  });

  it("prefers the current key over the old one", () => {
    localStorage.setItem("buddyPmRepliesOpen", "true");
    writeRailOpen(false);
    expect(readRailOpen()).toBe(false);
  });

  it("survives storage that refuses", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readRailOpen()).toBeNull();
    expect(() => writeRailOpen(true)).not.toThrow();
    expect(readSeenReplyIds("u")).toEqual([]);
    expect(() => writeSeenReplyIds("u", ["1"])).not.toThrow();
  });
});

describe("seen replies", () => {
  afterEach(() => localStorage.clear());

  it("starts empty and round-trips the ids", () => {
    expect(readSeenReplyIds("u1")).toEqual([]);
    writeSeenReplyIds("u1", ["a", "b"]);
    expect(readSeenReplyIds("u1")).toEqual(["a", "b"]);
  });

  it("keeps each user's ids apart", () => {
    writeSeenReplyIds("u1", ["a"]);
    expect(readSeenReplyIds("u2")).toEqual([]);
  });

  it("treats unreadable stored data as nothing seen", () => {
    localStorage.setItem("buddyPmRepliesSeen:u1", "{not json");
    expect(readSeenReplyIds("u1")).toEqual([]);
  });
});
