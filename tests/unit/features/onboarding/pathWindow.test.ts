import { describe, expect, it } from "vitest";
import { pathWindow } from "../../../../src/features/onboarding/pathWindow.ts";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  StepStatus,
} from "../../../../src/features/onboarding/types.ts";

function phase(
  id: string,
  position: number,
  over: {
    steps?: StepStatus[];
    locked?: boolean;
    blockerIds?: string[];
  } = {},
): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path-1",
    position,
    title: `Phase ${id}`,
    description: "",
    locked: over.locked ?? false,
    blockerIds: over.blockerIds,
    questions: [],
    steps: (over.steps ?? []).map((status, index) => ({
      id: `${id}-step-${index}`,
      phaseId: id,
      position: index,
      title: "Step",
      description: "",
      type: "DOCUMENT" as const,
      estimatedMinutes: 10,
      expectedOutcomes: [],
      tasks: [],
      resources: [],
      status,
      startedAt: null,
      completedAt: null,
      feedback: null,
      skip: null,
    })),
  };
}

function path(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path-1", userId: "hire", createdAt: "", phases };
}

describe("pathWindow", () => {
  it("has nothing to draw for a path with no phases", () => {
    expect(pathWindow(path([])).nodes).toEqual([]);
  });

  it("puts the phase somebody is standing in at the middle of the window", () => {
    const window = pathWindow(
      path([
        phase("a", 0, { steps: ["FINISHED"] }),
        phase("b", 1, { steps: ["IN_PROGRESS"] }),
        phase("c", 2, { steps: ["WAITING"] }),
      ]),
    );

    expect(window.currentId).toBe("b");
    expect(window.nodes.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("follows the arrows where the path has them, rather than the listing order", () => {
    // `c` waits on `b` and sits at the far end of the list; position order would have missed it.
    const window = pathWindow(
      path([
        phase("a", 0, { steps: ["FINISHED"] }),
        phase("b", 1, { steps: ["IN_PROGRESS"], blockerIds: ["a"] }),
        phase("far", 2, { steps: ["WAITING"] }),
        phase("c", 3, { steps: ["WAITING"], blockerIds: ["b"] }),
      ]),
    );

    expect(window.nodes.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps only the arrows between the phases it drew, never one pointing out of the window", () => {
    const window = pathWindow(
      path([
        phase("a", 0, { steps: ["FINISHED"] }),
        phase("b", 1, { steps: ["IN_PROGRESS"], blockerIds: ["a", "elsewhere"] }),
      ]),
    );

    expect(window.nodes.find((node) => node.id === "b")?.blockerIds).toEqual(["a"]);
  });

  it("names where each phase stands, so the colour is never the only thing saying it", () => {
    const window = pathWindow(
      path([
        phase("a", 0, { steps: ["FINISHED"] }),
        phase("b", 1, { steps: ["IN_PROGRESS"] }),
        phase("c", 2, { steps: ["WAITING"], locked: true }),
      ]),
    );

    const states = Object.fromEntries(window.nodes.map((node) => [node.id, node.state]));
    expect(states).toEqual({ a: "done", b: "current", c: "locked" });
  });

  it("counts the steps that are behind somebody, skipped ones included", () => {
    const window = pathWindow(path([phase("a", 0, { steps: ["FINISHED", "SKIPPED", "WAITING"] })]));

    expect(window.nodes[0].progress).toEqual({ done: 2, total: 3 });
  });

  it("shows the end of a path somebody has finished rather than jumping back to its start", () => {
    const window = pathWindow(
      path([phase("a", 0, { steps: ["FINISHED"] }), phase("b", 1, { steps: ["FINISHED"] })]),
    );

    expect(window.currentId).toBe("b");
  });

  it("gives no phase a position, because a board has nowhere to keep one", () => {
    const window = pathWindow(path([phase("a", 0, { steps: ["WAITING"] })]));

    expect(window.nodes[0].graphX).toBeNull();
    expect(window.nodes[0].graphY).toBeNull();
  });

  it("stays small on a long path, because the question is where somebody is", () => {
    const window = pathWindow(
      path(
        Array.from({ length: 12 }, (_, index) =>
          phase(`p${index}`, index, { steps: [index < 3 ? "FINISHED" : "WAITING"] }),
        ),
      ),
    );

    expect(window.nodes.length).toBeLessThanOrEqual(5);
    expect(window.nodes.map((node) => node.id)).toContain(window.currentId);
  });
});
