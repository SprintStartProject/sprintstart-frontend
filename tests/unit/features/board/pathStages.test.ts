import { describe, expect, it } from "vitest";
import type { CardOrigins } from "../../../../src/features/board/layout/cardOrigins";
import {
  isCardAt,
  pathPhases,
  pathStages,
  placeOfUrl,
} from "../../../../src/features/board/layout/pathStages";
import type { BoardCard } from "../../../../src/features/board/types";
import type { OnboardingPathEndpoint } from "../../../../src/features/onboarding/types";

function note(id: string): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text: id },
  };
}

function stepCard(id: string, stepId: string): BoardCard {
  return {
    id,
    kind: "PATH_STEP",
    owner: "AI",
    position: 0,
    placedAt: null,
    content: { kind: "PATH_STEP", stepId },
  } as unknown as BoardCard;
}

const step = (id: string, status: string) => ({ id, status, position: 0 });

/** Three phases: p1 finished, p2 the one the hire is in, p3 locked behind it. */
const path = {
  id: "path",
  phases: [
    {
      id: "p3",
      title: "Ship",
      position: 3,
      locked: true,
      steps: [step("s3", "WAITING")],
      questions: [],
    },
    {
      id: "p1",
      title: "Setup",
      position: 1,
      steps: [step("s1", "FINISHED")],
      questions: [{ id: "q1", status: "PASSED", position: 0 }],
    },
    {
      id: "p2",
      title: "First task",
      position: 2,
      steps: [step("s2", "IN_PROGRESS")],
      questions: [{ id: "q2", status: "OPEN", position: 0 }],
    },
  ],
} as unknown as OnboardingPathEndpoint;

const phases = pathPhases(path);

describe("where a link points on the path", () => {
  it("reads every way the app writes one", () => {
    expect(placeOfUrl("/onboarding/s1#:~:text=abc")).toEqual({ kind: "step", id: "s1" });
    expect(placeOfUrl("/onboarding?step=s2")).toEqual({ kind: "step", id: "s2" });
    expect(placeOfUrl("/onboarding?question=q2")).toEqual({ kind: "question", id: "q2" });
    expect(placeOfUrl("/onboarding?phase=p3#:~:text=x")).toEqual({ kind: "phase", id: "p3" });
  });

  it("points at nothing outside the Onboarding page", () => {
    expect(placeOfUrl("/chat/abc")).toBeNull();
    expect(placeOfUrl("/onboarding")).toBeNull();
  });
});

describe("Now, Later and Behind you, read off the path", () => {
  const origins: CardOrigins = {
    ahead: { url: "/onboarding?step=s3", label: "Ship it" },
    current: { url: "/onboarding?question=q2", label: "Check" },
    finished: { url: "/onboarding/s1#:~:text=ssh", label: "Setup" },
    phase: { url: "/onboarding?phase=p1", label: "Recap of Setup" },
    chat: { url: "/chat/1", label: "A chat" },
  };
  const stageOf = pathStages(phases, origins);

  it("files a card under the phase its step is in", () => {
    expect(stageOf(note("ahead"))).toBe("LATER");
    expect(stageOf(note("current"))).toBe("NOW");
    expect(stageOf(note("finished"))).toBe("BEHIND");
    expect(stageOf(note("phase"))).toBe("BEHIND");
  });

  it("keeps a phase that is open beside the current one in Now", () => {
    const twoOpen = {
      ...path,
      phases: [
        ...path.phases,
        { id: "p4", title: "Side", position: 4, steps: [step("s4", "WAITING")], questions: [] },
      ],
    } as unknown as OnboardingPathEndpoint;
    const side: CardOrigins = { side: { url: "/onboarding?step=s4&open=1", label: "" } };

    expect(pathStages(pathPhases(twoOpen), side)(note("side"))).toBe("NOW");
  });

  it("keeps everything tied to nothing in Now", () => {
    expect(stageOf(note("chat"))).toBe("NOW");
    expect(stageOf(note("no-origin"))).toBe("NOW");
  });

  it("reads the live step card by its own step", () => {
    expect(stageOf(stepCard("live", "s2"))).toBe("NOW");
    expect(stageOf(stepCard("old", "s1"))).toBe("BEHIND");
  });

  it("puts everything in Now when there is no path", () => {
    expect(pathStages(null, origins)(note("ahead"))).toBe("NOW");
  });
});

describe("whether a card belongs to a step or a phase", () => {
  const origins: CardOrigins = {
    a: { url: "/onboarding?step=s2", label: "" },
    b: { url: "/onboarding?phase=p2", label: "" },
  };

  it("matches a step only by that step", () => {
    expect(isCardAt(note("a"), { kind: "step", id: "s2" }, phases, origins)).toBe(true);
    expect(isCardAt(note("b"), { kind: "step", id: "s2" }, phases, origins)).toBe(false);
  });

  it("counts a phase's steps as the phase", () => {
    expect(isCardAt(note("a"), { kind: "phase", id: "p2" }, phases, origins)).toBe(true);
    expect(isCardAt(note("b"), { kind: "phase", id: "p2" }, phases, origins)).toBe(true);
  });

  it("matches a phase by name only, without the path", () => {
    expect(isCardAt(note("a"), { kind: "phase", id: "p2" }, null, origins)).toBe(false);
    expect(isCardAt(note("b"), { kind: "phase", id: "p2" }, null, origins)).toBe(true);
  });
});
