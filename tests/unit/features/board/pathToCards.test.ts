import { describe, it, expect } from "vitest";
import {
  markTitle,
  planCardsFromPath,
  readableTitle,
  sourceOfTitle,
} from "../../../../src/features/board/generation/pathToCards";
import type {
  OnboardingPathEndpoint,
  OnboardingPhaseEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/features/onboarding/types";

function step(over: Partial<OnboardingStepEndpoint> = {}): OnboardingStepEndpoint {
  return {
    id: "step-1",
    phaseId: "phase-1",
    position: 0,
    title: "Set up your machine",
    description: "",
    type: "TASK",
    estimatedMinutes: 30,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...over,
  };
}

function phase(over: Partial<OnboardingPhaseEndpoint> = {}): OnboardingPhaseEndpoint {
  return {
    id: "phase-1",
    pathId: "path-1",
    position: 0,
    title: "Getting set up",
    description: "",
    locked: false,
    unlockReason: null,
    checkSummary: {
      required: false,
      questionCount: 0,
      passed: false,
      latestAttemptId: null,
      latestAttemptAt: null,
    },
    steps: [step()],
    ...over,
  };
}

function path(phases: OnboardingPhaseEndpoint[]): OnboardingPathEndpoint {
  return { id: "path-1", userId: "user-1", createdAt: "2026-01-01T00:00:00Z", phases };
}

describe("planCardsFromPath", () => {
  it("makes one card per step, with its tasks as the lines", () => {
    const plan = planCardsFromPath(
      path([
        phase({
          steps: [
            step({
              tasks: [
                {
                  id: "t2",
                  stepId: "step-1",
                  position: 1,
                  title: "Install Node",
                  description: "",
                  finished: false,
                },
                {
                  id: "t1",
                  stepId: "step-1",
                  position: 0,
                  title: "Clone the repo",
                  description: "",
                  finished: false,
                },
              ],
            }),
          ],
        }),
      ]),
    );

    expect(plan.cardCount).toBe(1);
    const request = plan.areas[0].cards[0].request;
    expect(request.kind).toBe("CHECKLIST");
    if (request.kind !== "CHECKLIST") throw new Error("expected a checklist");
    expect(request.items.map((item) => item.text)).toEqual(["Clone the repo", "Install Node"]);
  });

  it("names the area after the phase and stages it by position", () => {
    const plan = planCardsFromPath(
      path([
        phase({ id: "p1", position: 0, title: "Week one" }),
        phase({ id: "p2", position: 1, title: "Week two", steps: [step({ id: "s2" })] }),
        phase({ id: "p3", position: 2, title: "Later on", steps: [step({ id: "s3" })] }),
      ]),
    );

    expect(plan.areas.map((area) => [area.name, area.stage])).toEqual([
      ["Week one", "NOW"],
      ["Week two", "NEXT"],
      ["Later on", "LATER"],
    ]);
  });

  it("chains steps inside a phase but not across phases", () => {
    const plan = planCardsFromPath(
      path([
        phase({
          id: "p1",
          steps: [step({ id: "a", position: 0 }), step({ id: "b", position: 1 })],
        }),
        phase({ id: "p2", position: 1, steps: [step({ id: "c" })] }),
      ]),
    );

    expect(plan.areas[0].cards.map((card) => card.afterKey)).toEqual([null, "a"]);
    // Across phases the stage carries the order. Chaining here too would leave the hire with
    // exactly one card they are allowed to open.
    expect(plan.areas[1].cards[0].afterKey).toBeNull();
  });

  it("leaves finished and skipped steps off the board", () => {
    const plan = planCardsFromPath(
      path([
        phase({
          steps: [
            step({ id: "done", status: "FINISHED" }),
            step({ id: "skipped", position: 1, status: "SKIPPED" }),
            step({ id: "open", position: 2 }),
          ],
        }),
      ]),
    );

    expect(plan.cardCount).toBe(1);
    expect(plan.areas[0].cards[0].key).toBe("open");
  });

  it("falls back to expected outcomes, then to the step's own title", () => {
    const plan = planCardsFromPath(
      path([
        phase({
          steps: [
            step({ id: "outcomes", expectedOutcomes: ["The project builds locally"] }),
            step({ id: "bare", position: 1, title: "Read the architecture doc" }),
          ],
        }),
      ]),
    );

    const lines = plan.areas[0].cards.map((card) =>
      card.request.kind === "CHECKLIST" ? card.request.items.map((item) => item.text) : [],
    );
    expect(lines).toEqual([["The project builds locally"], ["Read the architecture doc"]]);
  });

  it("produces no area for a phase with nothing left to do", () => {
    const plan = planCardsFromPath(path([phase({ steps: [step({ status: "FINISHED" })] })]));

    expect(plan.areas).toEqual([]);
  });
});

describe("card source markers", () => {
  it("round-trips a title through a marker without changing what a person reads", () => {
    const stored = markTitle("TEAM", "Read the incident write-up");

    expect(sourceOfTitle(stored)).toBe("TEAM");
    expect(readableTitle(stored)).toBe("Read the incident write-up");
  });

  it("tells the two generated sources apart", () => {
    expect(sourceOfTitle(markTitle("PATH", "Set up your machine"))).toBe("PATH");
    expect(sourceOfTitle(markTitle("TEAM", "Set up your machine"))).toBe("TEAM");
  });

  it("reports a hand-written title as coming from nobody", () => {
    expect(sourceOfTitle("Groceries")).toBeNull();
    expect(sourceOfTitle(null)).toBeNull();
    expect(readableTitle("Groceries")).toBe("Groceries");
  });

  it("marks path cards as coming from the path", () => {
    const plan = planCardsFromPath(path([phase()]));
    const request = plan.areas[0].cards[0].request;
    if (request.kind !== "CHECKLIST") throw new Error("expected a checklist");

    expect(sourceOfTitle(request.title ?? null)).toBe("PATH");
    expect(readableTitle(request.title ?? "")).toBe("Set up your machine");
  });
});
