import { describe, it, expect } from "vitest";
import {
  RISK_LIST_LIMIT,
  draftProblem,
  endOfDay,
  parsePeople,
  toRiskQuery,
} from "../../../../src/features/offboarding/departure";

describe("parsePeople", () => {
  it("splits on commas, spaces, semicolons and lines and trims", () => {
    expect(parsePeople(" ada@x.org,ben ;carol\n dan\t")).toEqual([
      "ada@x.org",
      "ben",
      "carol",
      "dan",
    ]);
  });

  it("keeps the order given and drops repeats that differ only by letter case", () => {
    expect(parsePeople("Ada ben ada BEN carol")).toEqual(["Ada", "ben", "carol"]);
  });

  it("finds nobody in blank input", () => {
    expect(parsePeople("  ,; \n ")).toEqual([]);
    expect(parsePeople("")).toEqual([]);
  });
});

describe("endOfDay", () => {
  it("turns a calendar day into the last second of that day", () => {
    expect(endOfDay("2026-11-20")).toBe("2026-11-20T23:59:59Z");
  });

  it("leaves an empty or malformed day open", () => {
    expect(endOfDay("")).toBeUndefined();
    expect(endOfDay("20.11.2026")).toBeUndefined();
    expect(endOfDay("2026-1-20")).toBeUndefined();
    expect(endOfDay("2026-11-20x")).toBeUndefined();
    expect(endOfDay("x2026-11-20")).toBeUndefined();
  });
});

describe("draftProblem", () => {
  const ok = { people: ["ada"], asOfDay: "", reviewWeight: "" };

  it("accepts a departure of at least one person", () => {
    expect(draftProblem(ok)).toBeNull();
  });

  it("asks for somebody who is leaving", () => {
    expect(draftProblem({ ...ok, people: [] })).toMatch(/at least one person/);
  });

  it("accepts a review weight of zero or more and an empty one", () => {
    expect(draftProblem({ ...ok, reviewWeight: "0" })).toBeNull();
    expect(draftProblem({ ...ok, reviewWeight: "0.5" })).toBeNull();
    expect(draftProblem({ ...ok, reviewWeight: " " })).toBeNull();
  });

  it("refuses a review weight that is negative or not a number", () => {
    expect(draftProblem({ ...ok, reviewWeight: "-1" })).toMatch(/review weight/);
    expect(draftProblem({ ...ok, reviewWeight: "lots" })).toMatch(/review weight/);
  });
});

describe("toRiskQuery", () => {
  it("builds the request a draft stands for", () => {
    expect(
      toRiskQuery({ people: ["ada", "ben"], asOfDay: "2026-11-20", reviewWeight: "0.5" }),
    ).toEqual({
      leaving: ["ada", "ben"],
      asOf: "2026-11-20T23:59:59Z",
      reviewWeight: 0.5,
      limit: RISK_LIST_LIMIT,
    });
  });

  it("leaves reviews out and the date open when they were not given", () => {
    const query = toRiskQuery({ people: ["ada"], asOfDay: "", reviewWeight: "" });

    expect(query.asOf).toBeUndefined();
    expect(query.reviewWeight).toBeUndefined();
  });

  it("reads a review weight with blanks around it", () => {
    expect(toRiskQuery({ people: ["ada"], asOfDay: "", reviewWeight: " 0.5 " }).reviewWeight).toBe(
      0.5,
    );
  });

  it("passes a review weight of zero on", () => {
    expect(toRiskQuery({ people: ["ada"], asOfDay: "", reviewWeight: "0" }).reviewWeight).toBe(0);
  });
});
