import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberJourneySection } from "../../../../../../src/features/team-management/components/detail/MemberJourneySection";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
} from "../../../../../../src/features/onboarding/types";

function step(overrides: Partial<OnboardingStepEndpoint>): OnboardingStepEndpoint {
  return {
    id: "s",
    phaseId: "phase1",
    position: 0,
    title: "Step",
    description: "",
    type: "TASK",
    estimatedMinutes: 15,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status: "WAITING",
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    ...overrides,
  };
}

const path: OnboardingPathEndpoint = {
  id: "path1",
  userId: "user1",
  createdAt: "",
  phases: [
    {
      id: "phase1",
      pathId: "path1",
      position: 0,
      title: "Environment Setup",
      description: "Get the project running.",
      locked: false,
      steps: [
        step({ id: "clone", title: "Clone the repository", status: "FINISHED" }),
        step({ id: "run", position: 1, title: "Start the app", blockerIds: ["clone"] }),
        step({
          id: "verify",
          position: 2,
          title: "Verify it works",
          blockerIds: ["run"],
          locked: true,
        }),
      ],
      questions: [],
    },
    {
      id: "phase2",
      pathId: "path1",
      position: 1,
      title: "Architecture",
      description: "",
      locked: true,
      blockerIds: ["phase1"],
      steps: [step({ id: "adr", phaseId: "phase2", title: "Read the ADRs" })],
      questions: [],
    },
  ],
};

function renderSection(overrides: Partial<Parameters<typeof MemberJourneySection>[0]> = {}) {
  const props = {
    userId: "user1",
    memberName: "Alice Smith",
    path,
    stepTaskCounts: {},
    onOpenStep: vi.fn(),
    onOpenQuestions: vi.fn(),
    onAddStep: vi.fn(),
    onDeleteStep: vi.fn(),
    onPathChanged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<MemberJourneySection {...props} />);
  return props;
}

describe("MemberJourneySection", () => {
  it("opens on the phase the member is in, with items in graph order", () => {
    renderSection();

    const list = screen.getByRole("list", { name: "Environment Setup: steps and questions" });
    const titles = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("Clone the repository");
    expect(titles[1]).toContain("Member is here");
    expect(titles[2]).toContain("Waits on Start the app");
  });

  it("adds a step straight after an item, in front of what waited on it", async () => {
    const user = userEvent.setup();
    const { onAddStep } = renderSection();

    await user.click(screen.getByRole("button", { name: "Add a step after Start the app" }));

    expect(onAddStep).toHaveBeenCalledWith({
      phaseId: "phase1",
      waitsOn: ["run"],
      unlocks: ["verify"],
    });
  });

  it("opens a step's details and a phase's questions", async () => {
    const user = userEvent.setup();
    const { onOpenStep, onOpenQuestions } = renderSection();

    await user.click(screen.getByRole("button", { name: /^Clone the repository/ }));
    expect(onOpenStep).toHaveBeenCalledWith("clone");

    await user.click(screen.getByRole("button", { name: "Add questions" }));
    expect(onOpenQuestions).toHaveBeenCalledWith("phase1", "questions");
  });

  it("shows the phase graph with the PM's arranging tools", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Graph" }));

    expect(
      await screen.findByRole("application", {
        name: "Graph of the steps and questions in Environment Setup",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Arrange nodes" }));
    // Arranging turns on the ports edges are drawn from.
    expect(screen.getAllByTitle("Drag to what this unlocks").length).toBe(3);
  });

  it("says so when the member has no path yet", () => {
    renderSection({ path: null });

    expect(screen.getByText(/has no onboarding path yet/)).toBeInTheDocument();
  });
});
