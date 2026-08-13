import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { StepDetailsPanel } from "../../../src/features/team-management/components/detail/StepDetailsPanel";
import type {
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
} from "../../../src/features/onboarding/types";

const step: OnboardingStepEndpoint = {
  id: "s1",
  phaseId: "p1",
  position: 0,
  title: "Setup environment",
  description: "Get your dev environment ready.",
  type: "TASK",
  estimatedMinutes: 30,
  expectedOutcomes: ["Node.js installed"],
  tasks: [],
  resources: [],
  status: "IN_PROGRESS",
  startedAt: "2026-07-01T00:00:00.000Z",
  completedAt: null,
  feedback: null,
  skip: null,
};

const tasks: OnboardingTaskEndpoint[] = [
  {
    id: "t1",
    stepId: "s1",
    position: 0,
    title: "Install Node.js",
    description: "",
    finished: false,
  },
  {
    id: "t2",
    stepId: "s1",
    position: 1,
    title: "Install dependencies",
    description: "Run npm install",
    finished: true,
  },
];

describe("StepDetailsPanel Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <StepDetailsPanel
          step={step}
          tasks={tasks}
          doneTaskCount={1}
          actualMinutes={15}
          feedbackItems={[]}
          skipReason=""
          taskInsertTarget={null}
          newTaskTitle=""
          newTaskDescription=""
          addingTask={false}
          stepActionId={null}
          stepToDelete={null}
          taskToDelete={null}
          onClose={vi.fn()}
          onRequestDeleteStep={vi.fn()}
          onCancelDeleteStep={vi.fn()}
          onConfirmDeleteStep={vi.fn()}
          onRequestDeleteTask={vi.fn()}
          onCancelDeleteTask={vi.fn()}
          onConfirmDeleteTask={vi.fn()}
          onTaskInsertTargetChange={vi.fn()}
          onNewTaskTitleChange={vi.fn()}
          onNewTaskDescriptionChange={vi.fn()}
          onCreateTask={vi.fn()}
          formatMinutes={(m) => (m ? `${m} min` : "—")}
          getStepStatusStyles={() => "bg-app-warning-bg text-app-warning-text"}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Setup environment")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Delete Install Node.js" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete step" })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
