import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetOrigin,
  originOf,
  readCardOrigins,
  rememberOrigin,
  writeCardOrigins,
} from "../../../../src/features/board/layout/cardOrigins";

describe("where a card came from", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips an origin", () => {
    writeCardOrigins("p1", { c1: { url: "/knowledge-base#:~:text=deploys", label: "Deployment" } });

    expect(readCardOrigins("p1").c1).toEqual({
      url: "/knowledge-base#:~:text=deploys",
      label: "Deployment",
    });
  });

  it("adds one card's origin without the caller holding the others", () => {
    rememberOrigin("p1", "c1", { url: "/a", label: "A" });
    rememberOrigin("p1", "c2", { url: "/b", label: "B" });

    expect(Object.keys(readCardOrigins("p1"))).toEqual(["c1", "c2"]);
  });

  it("keeps projects apart", () => {
    rememberOrigin("p1", "c1", { url: "/a", label: "A" });

    expect(readCardOrigins("p2")).toEqual({});
  });

  it("forgets one card without touching the rest", () => {
    rememberOrigin("p1", "c1", { url: "/a", label: "A" });
    rememberOrigin("p1", "c2", { url: "/b", label: "B" });

    forgetOrigin("p1", "c1");

    expect(originOf(readCardOrigins("p1"), "c1")).toBeNull();
    expect(originOf(readCardOrigins("p1"), "c2")).not.toBeNull();
  });

  it("stands the path in for a missing label rather than losing the way back", () => {
    window.localStorage.setItem(
      "sprintstart:board-card-origins:p3",
      JSON.stringify({ version: 1, origins: { c1: { url: "/onboarding/4" } } }),
    );

    expect(readCardOrigins("p3").c1).toEqual({ url: "/onboarding/4", label: "/onboarding/4" });
  });

  it("reads rubbish in storage as nothing rather than falling over", () => {
    window.localStorage.setItem("sprintstart:board-card-origins:p4", "{not json");
    expect(readCardOrigins("p4")).toEqual({});

    window.localStorage.setItem(
      "sprintstart:board-card-origins:p5",
      JSON.stringify({ version: 1, origins: { c1: { label: "no url" } } }),
    );

    // An entry with no address is not a way back, so it says nothing and is dropped.
    expect(readCardOrigins("p5")).toEqual({});
  });

  it("has no origin for a card nobody recorded one for", () => {
    expect(originOf({}, "c9")).toBeNull();
    expect(originOf(undefined, "c9")).toBeNull();
  });
});
