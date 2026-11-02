import { describe, expect, it } from "vitest";
import type { BuddySessionSummary } from "../../../../src/services/buddyService";
import {
  blankSession,
  chooseSession,
  hasBlankTitle,
  mergeFetchedSessions,
  reusableBlankSession,
} from "../../../../src/features/buddy/conversation/sessionRules";

const session = (id: string, title = "Something"): BuddySessionSummary => ({
  id,
  title,
  projectId: null,
  createdAt: "2026-01-01T00:00:00Z",
});

const ids = (list: BuddySessionSummary[]) => list.map((s) => s.id);

describe("blankSession", () => {
  it("has no title and belongs to no project", () => {
    expect(blankSession("s1", "t")).toEqual({
      id: "s1",
      title: "",
      projectId: null,
      createdAt: "t",
    });
  });
});

describe("hasBlankTitle", () => {
  it("is true for an empty or whitespace title only", () => {
    expect(hasBlankTitle(session("a", ""))).toBe(true);
    expect(hasBlankTitle(session("a", "   "))).toBe(true);
    expect(hasBlankTitle(session("a", "Hi"))).toBe(false);
  });
});

describe("chooseSession", () => {
  const list = [session("new"), session("mid"), session("old")];

  it("opens the one the address names", () => {
    expect(chooseSession(list, "old", "mid")).toBe("old");
  });

  it("falls back to the one the hire was in when the address names none the list holds", () => {
    expect(chooseSession(list, "gone", "mid")).toBe("mid");
    expect(chooseSession(list, null, "mid")).toBe("mid");
  });

  it("falls back to the newest when neither is held", () => {
    expect(chooseSession(list, "gone", "also-gone")).toBe("new");
    expect(chooseSession(list, null, null)).toBe("new");
  });
});

describe("mergeFetchedSessions", () => {
  it("drops what the hire has binned since the read began", () => {
    const next = mergeFetchedSessions([session("a"), session("b")], new Set(["b"]), []);

    expect(ids(next)).toEqual(["a"]);
  });

  it("keeps a conversation created while the read was in flight, in front", () => {
    const next = mergeFetchedSessions([session("a")], new Set(), [session("fresh"), session("a")]);

    expect(ids(next)).toEqual(["fresh", "a"]);
  });

  it("takes the server's row for one both sides know", () => {
    const next = mergeFetchedSessions([session("a", "Titled")], new Set(), [session("a", "")]);

    expect(next).toEqual([session("a", "Titled")]);
  });
});

describe("reusableBlankSession", () => {
  it("is the newest conversation when it is blank and not the one open", () => {
    const list = [session("new", ""), session("old")];

    expect(reusableBlankSession(list, "old")?.id).toBe("new");
  });

  it("is nothing when the blank one is already open", () => {
    expect(reusableBlankSession([session("new", "")], "new")).toBeUndefined();
  });

  it("is nothing when the newest has a title", () => {
    expect(reusableBlankSession([session("new", "Titled")], "other")).toBeUndefined();
  });

  it("is nothing for an empty list", () => {
    expect(reusableBlankSession([], null)).toBeUndefined();
  });
});
