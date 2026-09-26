import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MemberSignals,
  MemberSummary,
} from "../../../../src/features/pm-area/components/MemberSummary";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/features/onboarding/types";
import type { TeamOverviewUser } from "../../../../src/features/team-management/types";

function step(overrides: Partial<OnboardingStepEndpoint>): OnboardingStepEndpoint {
  return {
    id: "s",
    phaseId: "phase1",
    position: 0,
    title: "Step",
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
      description: "",
      locked: false,
      steps: [step({ id: "clone", title: "Clone the repository", status: "FINISHED" })],
      questions: [],
    },
    {
      id: "phase2",
      pathId: "path1",
      position: 1,
      title: "Architecture",
      description: "",
      locked: false,
      steps: [
        step({ id: "adr", phaseId: "phase2", title: "Read the ADRs", status: "IN_PROGRESS" }),
      ],
      questions: [],
    },
    {
      id: "phase3",
      pathId: "path1",
      position: 2,
      title: "First ticket",
      description: "",
      locked: true,
      blockerIds: ["phase2"],
      steps: [step({ id: "ticket", phaseId: "phase3", title: "Pick a ticket" })],
      questions: [],
    },
  ],
};

const member = {
  userId: "user1",
  firstname: "Alice",
  lastname: "Smith",
  roles: [],
  skills: [],
  progressPercentage: 0.33,
  currentStep: { id: "adr", title: "Read the ADRs", startedAt: new Date().toISOString() },
  hasFeedback: false,
  projects: [],
} as unknown as TeamOverviewUser;

describe("MemberSummary", () => {
  it("shows the phase underway up close and the others by name, each a way to it", async () => {
    const user = userEvent.setup();
    const onOpenPhase = vi.fn();
    render(<MemberSummary member={member} path={path} feedback={[]} onOpenPhase={onOpenPhase} />);

    // The step they are on, in the close-up of the phase underway.
    expect(screen.getByText(/^On:/)).toHaveTextContent("On: Read the ADRs");

    // The whole card of the phase underway is the button, not only its title.
    await user.click(screen.getByRole("button", { name: /Architecture/ }));
    expect(onOpenPhase).toHaveBeenLastCalledWith("phase2");

    await user.click(screen.getByRole("button", { name: "Environment Setup" }));
    expect(onOpenPhase).toHaveBeenLastCalledWith("phase1");

    await user.click(screen.getByRole("button", { name: "First ticket" }));
    expect(onOpenPhase).toHaveBeenLastCalledWith("phase3");
  });
});

describe("MemberSignals", () => {
  it("takes the manager down to the path from any of its figures", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <MemberSignals
        path={path}
        feedback={[]}
        skillLevels={[]}
        knowledgeGapCount={2}
        onOpen={onOpen}
      />,
    );

    const figures = screen.getAllByRole("button");
    expect(figures).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: /Workload/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2 knowledge gaps")).toBeInTheDocument();
  });
});
