import { describe, expect, it } from "vitest";
import {
  arrangeLabel,
  derivePhaseView,
  freeSpot,
  itemEdgeTone,
  itemNodeLabel,
  itemOpener,
  mapHint,
  mergeLocalPositions,
  nodesToSave,
  phaseEdgeTone,
  phaseNodeLabel,
  phaseNodesOf,
  pinnedPositions,
  ruleNodes,
} from "../../../../../../src/features/onboarding/components/journey/graphView/graphRules";
import type { GraphEditing } from "../../../../../../src/features/onboarding/components/journey/graphView/graphTypes";
import { ITEM_NODE_SIZE } from "../../../../../../src/features/onboarding/graph/graphLayouts";
import { phaseItems } from "../../../../../../src/features/onboarding/journey";
import type {
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../../../../../../src/services/onboardingTypes";

function step(
  id: string,
  status: OnboardingStepEndpoint["status"],
  over = {},
): OnboardingStepEndpoint {
  return {
    id,
    phaseId: "p",
    position: 0,
    title: `Step ${id}`,
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...over,
  };
}

function phase(id: string, steps: OnboardingStepEndpoint[], over = {}): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: 0,
    title: `Phase ${id}`,
    description: "",
    locked: false,
    steps,
    questions: [],
    ...over,
  };
}

describe("phaseNodesOf", () => {
  it("numbers phases and defaults missing blockers and positions", () => {
    const [first, second] = phaseNodesOf([
      phase("a", [], { blockerIds: ["x"], graphX: 5, graphY: 6 }),
      phase("b", []),
    ]);
    expect(first).toMatchObject({ id: "a", index: 0, blockerIds: ["x"], graphX: 5, graphY: 6 });
    expect(second).toMatchObject({ id: "b", index: 1, blockerIds: [], graphX: null, graphY: null });
  });
});

describe("mergeLocalPositions", () => {
  const resolved = {
    positions: new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 10, y: 10 }],
    ]),
    isAutomatic: true,
  };

  it("is the resolved layout itself without local moves", () => {
    expect(mergeLocalPositions(resolved, undefined)).toBe(resolved);
  });

  it("lays this visit's moves over it and keeps the automatic flag", () => {
    const merged = mergeLocalPositions(resolved, { b: { x: 99, y: 98 }, c: { x: 1, y: 2 } });
    expect(merged.positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(merged.positions.get("b")).toEqual({ x: 99, y: 98 });
    expect(merged.positions.get("c")).toEqual({ x: 1, y: 2 });
    expect(merged.isAutomatic).toBe(true);
    expect(resolved.positions.get("b")).toEqual({ x: 10, y: 10 });
  });
});

describe("nodesToSave", () => {
  const next = new Map([
    ["a", { x: 1, y: 2 }],
    ["b", { x: 3, y: 4 }],
  ]);

  it("saves only what moved once the layout is pinned", () => {
    expect(nodesToSave(next, ["b"], false)).toEqual([{ id: "b", graphX: 3, graphY: 4 }]);
  });

  it("saves everything while the layout is still automatic", () => {
    expect(nodesToSave(next, ["b"], true)).toHaveLength(2);
  });

  it("saves everything when nothing in particular moved (tidy up)", () => {
    expect(nodesToSave(next, [], false)).toEqual([
      { id: "a", graphX: 1, graphY: 2 },
      { id: "b", graphX: 3, graphY: 4 },
    ]);
  });
});

describe("freeSpot", () => {
  const { width, height } = ITEM_NODE_SIZE;

  it("keeps a free spot as it is and does not change its input", () => {
    const point = { x: 5, y: 5 };
    expect(freeSpot(point, [])).toEqual({ x: 5, y: 5 });
    expect(freeSpot(point, [{ x: 5000, y: 5000 }])).toEqual({ x: 5, y: 5 });
    expect(point).toEqual({ x: 5, y: 5 });
  });

  it("slides down past a card it would sit on", () => {
    expect(freeSpot({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toEqual({ x: 0, y: height + 32 });
  });

  it("keeps sliding past a stack of cards", () => {
    const step = height + 32;
    const taken = [0, 1, 2].map((n) => ({ x: 0, y: n * step }));
    expect(freeSpot({ x: 0, y: 0 }, taken)).toEqual({ x: 0, y: 3 * step });
  });

  it("treats a card just inside its width and height margin as in the way, and just outside as free", () => {
    expect(freeSpot({ x: 0, y: 0 }, [{ x: width + 15, y: 0 }]).y).toBeGreaterThan(0);
    expect(freeSpot({ x: 0, y: 0 }, [{ x: width + 16, y: 0 }]).y).toBe(0);
    expect(freeSpot({ x: 0, y: 0 }, [{ x: 0, y: height + 15 }]).y).toBeGreaterThan(0);
    expect(freeSpot({ x: 0, y: 0 }, [{ x: 0, y: height + 16 }]).y).toBe(0);
  });
});

describe("edge tones", () => {
  const nodeOf = (p: OnboardingPhaseEndpoint) => phaseNodesOf([p])[0];
  const done = phase("d", [step("1", "FINISHED")]);
  const waiting = phase("w", [step("2", "WAITING")]);

  it("keeps an arrow waiting until its source phase is done", () => {
    expect(phaseEdgeTone(nodeOf(waiting), nodeOf(done))).toBe("waiting");
  });

  it("makes an arrow live when the source is done and the target is not", () => {
    expect(phaseEdgeTone(nodeOf(done), nodeOf(waiting))).toBe("active");
  });

  it("makes an arrow done when both ends are", () => {
    expect(phaseEdgeTone(nodeOf(done), nodeOf(done))).toBe("done");
  });

  it("tones step arrows the same way, with a locked target staying quiet", () => {
    const [finished] = phaseItems(phase("x", [step("1", "FINISHED")]));
    const [open] = phaseItems(phase("x", [step("2", "WAITING")]));
    expect(itemEdgeTone(open, finished, false)).toBe("waiting");
    expect(itemEdgeTone(finished, open, false)).toBe("active");
    expect(itemEdgeTone(finished, finished, false)).toBe("done");
    expect(itemEdgeTone(finished, open, true)).toBe("done");
  });
});

describe("labels", () => {
  it("names a phase by number, title, state and progress", () => {
    const node = phaseNodesOf([phase("a", [step("1", "FINISHED"), step("2", "WAITING")])])[0];
    expect(phaseNodeLabel(node)).toMatch(/^Phase 1: Phase a, .+, 50% complete$/);
  });

  it("names a step or a question with its state", () => {
    const [item] = phaseItems(phase("x", [step("1", "FINISHED")]));
    expect(itemNodeLabel(item, false)).toMatch(/^Step: Step 1, .+/);
  });

  it("says what the arrange button does", () => {
    const editing = {} as GraphEditing;
    expect(arrangeLabel(true, undefined)).toBe("Done arranging");
    expect(arrangeLabel(true, editing)).toBe("Done arranging");
    expect(arrangeLabel(false, editing)).toBe("Edit: move nodes and draw connections");
    expect(arrangeLabel(false, undefined)).toBe("Arrange nodes");
  });

  it("hints at what to do on the map", () => {
    const editing = {} as GraphEditing;
    expect(mapHint(false, editing)).toBe("· Click a phase to step inside");
    expect(mapHint(true, undefined)).toBe("· Drag phases to arrange them");
    expect(mapHint(true, editing)).toContain("port");
  });
});

describe("phase view helpers", () => {
  const items = phaseItems(phase("x", [step("1", "FINISHED"), step("2", "WAITING")]));

  it("finds the selected item, and the opened one only where items open up", () => {
    expect(derivePhaseView(items, "1", "2", true)).toEqual({
      selectedItem: items[0],
      focusedItem: items[1],
    });
    expect(derivePhaseView(items, "1", "2", false).focusedItem).toBeNull();
    expect(derivePhaseView(items, "zzz", null, true)).toEqual({
      selectedItem: null,
      focusedItem: null,
    });
  });

  it("opens an item by id, only when there is a handler", () => {
    const opened: string[] = [];
    expect(itemOpener(items, undefined)).toBeUndefined();
    const open = itemOpener(items, (item) => opened.push(item.id))!;
    open("2");
    open("missing");
    expect(opened).toEqual(["2"]);
  });

  it("hands the rules the nodes with blockers defaulted and no positions", () => {
    expect(ruleNodes([{ id: "a" }, { id: "b", blockerIds: ["a"] }])).toEqual([
      { id: "a", blockerIds: [], graphX: null, graphY: null },
      { id: "b", blockerIds: ["a"], graphX: null, graphY: null },
    ]);
  });

  it("pins every node where it stands", () => {
    expect(pinnedPositions(new Map([["a", { x: 1, y: 2 }]]))).toEqual([
      { id: "a", graphX: 1, graphY: 2 },
    ]);
  });
});
