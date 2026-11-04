import { describe, expect, it } from "vitest";
import {
  coOwnerNames,
  documentsMissing,
  firstIngestedOf,
  missingLabel,
  openGaps,
  planWideGrid,
  pressLabels,
  worstFirst,
} from "../../../../src/features/dashboard/components/gaps/gapRules";
import type { KnowledgeGap } from "../../../../src/features/knowledge-gaps/types";

function gap(
  component: string,
  severity: KnowledgeGap["severity"],
  extra: Partial<KnowledgeGap> = {},
): KnowledgeGap {
  return {
    id: `gap-${component}`,
    component,
    missingTypes: ["runbook"],
    lastIngested: "2026-08-01T00:00:00Z",
    refreshedAt: "2026-08-10T00:00:00Z",
    severity,
    owners: [],
    ...extra,
  };
}

const many = (count: number): KnowledgeGap[] =>
  Array.from({ length: count }, (_, index) => gap(`c${index}`, "high"));

describe("worstFirst / openGaps", () => {
  it("orders by severity and then by component name, without mutating the input", () => {
    const input = [gap("b", "low"), gap("z", "high"), gap("a", "high")];
    const sorted = worstFirst(input);

    expect(sorted.map((entry) => entry.component)).toEqual(["a", "z", "b"]);
    expect(input.map((entry) => entry.component)).toEqual(["b", "z", "a"]);
  });

  it("drops covered components, which are not to-do items", () => {
    const result = openGaps([gap("done", "covered"), gap("open", "medium")]);

    expect(result.map((entry) => entry.component)).toEqual(["open"]);
  });

  it("is empty when everything is covered", () => {
    expect(openGaps([gap("done", "covered")])).toEqual([]);
  });
});

describe("documentsMissing / missingLabel", () => {
  it("sums the missing types across gaps", () => {
    const gaps = [gap("a", "high", { missingTypes: ["x", "y"] }), gap("b", "low")];

    expect(documentsMissing(gaps)).toBe(3);
    expect(documentsMissing([])).toBe(0);
  });

  it("uses the singular only for exactly one", () => {
    expect(missingLabel(1)).toBe("1 document missing");
    expect(missingLabel(0)).toBe("0 documents missing");
    expect(missingLabel(2)).toBe("2 documents missing");
  });
});

describe("firstIngestedOf", () => {
  it("falls back to the last ingest when the first is absent", () => {
    expect(firstIngestedOf(gap("a", "low"))).toBe("2026-08-01T00:00:00Z");
    expect(firstIngestedOf(gap("a", "low", { firstIngested: "2026-01-01T00:00:00Z" }))).toBe(
      "2026-01-01T00:00:00Z",
    );
  });
});

describe("coOwnerNames", () => {
  const owners = [
    { id: "me", firstname: "Me", lastname: "Self" },
    { id: "u2", firstname: "Ada", lastname: "Lovelace" },
    { id: "u3", firstname: "Alan", lastname: "Turing" },
  ] as KnowledgeGap["owners"];

  it("lists everyone but the caller", () => {
    expect(coOwnerNames(gap("a", "low", { owners }), "me")).toBe("Ada Lovelace, Alan Turing");
  });

  it("lists everyone when nobody is signed in", () => {
    expect(coOwnerNames(gap("a", "low", { owners }), null)).toBe(
      "Me Self, Ada Lovelace, Alan Turing",
    );
  });

  it("is empty when the caller is the only owner", () => {
    expect(coOwnerNames(gap("a", "low", { owners: owners.slice(0, 1) }), "me")).toBe("");
  });
});

describe("planWideGrid", () => {
  it("gives two gaps a single row of two with rich cards", () => {
    const plan = planWideGrid(many(2));

    expect(plan).toMatchObject({
      remaining: 0,
      gridClass: "grid-cols-2 grid-rows-1",
      rich: true,
    });
    expect(plan.celled).toHaveLength(2);
  });

  it("gives three gaps a single row of three with rich cards", () => {
    const plan = planWideGrid(many(3));

    expect(plan.gridClass).toBe("grid-cols-3 grid-rows-1");
    expect(plan.rich).toBe(true);
  });

  it("gives four gaps a 2x2 of plain cards", () => {
    const plan = planWideGrid(many(4));

    expect(plan.gridClass).toBe("grid-cols-2 grid-rows-2");
    expect(plan.rich).toBe(false);
    expect(plan.remaining).toBe(0);
    expect(plan.celled).toHaveLength(4);
  });

  it("turns the fourth cell into a counter when there are more gaps than cells", () => {
    const plan = planWideGrid(many(7));

    expect(plan.celled).toHaveLength(3);
    expect(plan.remaining).toBe(4);
    expect(plan.gridClass).toBe("grid-cols-2 grid-rows-2");
    expect(plan.rich).toBe(false);
  });
});

describe("pressLabels", () => {
  it("has no label when the card cannot be pressed", () => {
    expect(pressLabels({ isPressable: false, canOpenDrawer: true, unseenCount: 2 })).toEqual({
      actionLabel: undefined,
      actionText: "Open your knowledge gaps",
    });
  });

  it("offers to mark as read when there is nothing to open", () => {
    expect(pressLabels({ isPressable: true, canOpenDrawer: false, unseenCount: 3 })).toEqual({
      actionLabel: "Mark 3 newly assigned components as read",
      actionText: "Mark as read",
    });
  });

  it("mentions the newly assigned count when the drawer opens", () => {
    expect(pressLabels({ isPressable: true, canOpenDrawer: true, unseenCount: 2 })).toEqual({
      actionLabel: "Open your knowledge gaps, 2 newly assigned",
      actionText: "Open your knowledge gaps",
    });
  });

  it("stays plain when nothing is new", () => {
    expect(pressLabels({ isPressable: true, canOpenDrawer: true, unseenCount: 0 })).toEqual({
      actionLabel: "Open your knowledge gaps",
      actionText: "Open your knowledge gaps",
    });
  });
});
