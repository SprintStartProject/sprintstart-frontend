import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepWorkspace } from "../../../../../../src/features/onboarding/components/journey/StepWorkspace";

const mocks = vi.hoisted(() => ({
  flyby: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../../../../src/features/moments", () => ({
  useMoments: () => ({ flyby: mocks.flyby, celebrate: vi.fn(), completeMission: vi.fn() }),
}));

vi.mock("../../../../../../src/context/useToast", () => ({
  useToast: () => mocks.toast,
}));

vi.mock("../../../../../../src/services/onboardingService", () => ({
  onboardingService: {
    fetchStep: vi.fn(),
    fetchTasks: vi.fn(),
    fetchResources: vi.fn(),
    startStep: vi.fn(),
    updateTask: vi.fn(),
    completeStep: vi.fn(),
    skipStep: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

import { onboardingService } from "../../../../../../src/services/onboardingService";

const baseStep = {
  id: "step1",
  phaseId: "phase1",
  position: 1,
  title: "Setup Environment",
  description: "Set up your dev environment",
  type: "TASK" as const,
  estimatedMinutes: 30,
  expectedOutcomes: [] as string[],
  tasks: [],
  resources: [],
  status: "IN_PROGRESS" as const,
  startedAt: null as string | null,
  completedAt: null as string | null,
  feedback: null as { helpful: boolean; comment: string } | null,
  skip: null as Record<string, unknown> | null,
};

function task(id: string, position: number, finished = false) {
  return { id, stepId: "step1", position, title: `Task ${id}`, description: "", finished };
}

function openStep(overrides: Partial<typeof baseStep> = {}) {
  vi.mocked(onboardingService.fetchStep).mockResolvedValue({ ...baseStep, ...overrides } as never);
}

function renderWorkspace(overrides: Partial<Parameters<typeof StepWorkspace>[0]> = {}) {
  const props = {
    stepId: "step1",
    onPathChanged: vi.fn().mockResolvedValue(undefined),
    continueLabel: "Next step",
    onContinue: vi.fn(),
    ...overrides,
  };
  const view = render(<StepWorkspace {...props} />);
  return { props, ...view };
}

describe("StepWorkspace flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openStep();
    vi.mocked(onboardingService.fetchTasks).mockResolvedValue([task("a", 1), task("b", 2)]);
    vi.mocked(onboardingService.fetchResources).mockResolvedValue([]);
  });

  describe("loading", () => {
    it("says it is loading until the step arrives", async () => {
      renderWorkspace();

      expect(screen.getByText("Loading step…")).toBeInTheDocument();
      await screen.findByText("Set up your dev environment");
      expect(screen.queryByText("Loading step…")).not.toBeInTheDocument();
    });

    it("names the failure of a read", async () => {
      vi.mocked(onboardingService.fetchStep).mockRejectedValue(new Error("nope"));
      renderWorkspace();

      expect(await screen.findByText(/Could not load this step: nope/)).toBeInTheDocument();
    });

    it("falls back to a generic message for a failure that is not an error", async () => {
      vi.mocked(onboardingService.fetchStep).mockRejectedValue("broken");
      renderWorkspace();

      expect(
        await screen.findByText(/Could not load this step: Unknown error/),
      ).toBeInTheDocument();
    });

    it("clears the failure when the next read works", async () => {
      vi.mocked(onboardingService.fetchStep).mockRejectedValueOnce(new Error("nope"));
      const { rerender, props } = renderWorkspace({ stepStatus: "WAITING" });
      await screen.findByText(/Could not load this step/);

      rerender(<StepWorkspace {...props} stepStatus="IN_PROGRESS" />);

      expect(await screen.findByText("Set up your dev environment")).toBeInTheDocument();
      expect(screen.queryByText(/Could not load this step/)).not.toBeInTheDocument();
    });
  });

  describe("header", () => {
    it("shows the estimate and how long the member has been on the step", async () => {
      openStep({ startedAt: new Date(Date.now() - 12 * 60_000).toISOString() });
      renderWorkspace();

      expect(await screen.findByText("30 min")).toBeInTheDocument();
      expect(screen.getByText(/· on it for 12 min/)).toBeInTheDocument();
    });

    it("says how long it took once the step is done", async () => {
      openStep({
        status: "FINISHED",
        startedAt: "2026-07-01T10:00:00Z",
        completedAt: "2026-07-01T10:30:00Z",
      });
      renderWorkspace();

      expect(await screen.findByText(/· took 30 min/)).toBeInTheDocument();
    });

    it("leaves the estimate and the time out when there is none", async () => {
      openStep({ estimatedMinutes: 0 });
      renderWorkspace();

      await screen.findByText("Set up your dev environment");
      expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/on it for/)).not.toBeInTheDocument();
    });

    it("leaves the description out when there is none", async () => {
      openStep({ description: "" });
      renderWorkspace();

      await screen.findByRole("button", { name: /Skip/ });
      expect(screen.queryByText("Set up your dev environment")).not.toBeInTheDocument();
    });

    it("sets the description larger in the focus layout", async () => {
      openStep();
      const inline = renderWorkspace();
      expect(await screen.findByText("Set up your dev environment")).toHaveClass("text-sm");
      inline.unmount();

      renderWorkspace({ layout: "focus" });
      expect(await screen.findByText("Set up your dev environment")).toHaveClass("text-base");
    });
  });

  describe("tasks and side panel", () => {
    it("lists tasks in position order", async () => {
      vi.mocked(onboardingService.fetchTasks).mockResolvedValue([task("b", 2), task("a", 1)]);
      renderWorkspace();

      const first = await screen.findByRole("button", { name: /Task a/ });
      const second = screen.getByRole("button", { name: /Task b/ });
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("says there is no checklist when a step has no tasks", async () => {
      vi.mocked(onboardingService.fetchTasks).mockResolvedValue([]);
      renderWorkspace();

      expect(await screen.findByText(/No checklist for this one/)).toBeInTheDocument();
      expect(screen.queryByText("Tasks")).not.toBeInTheDocument();
    });

    it("shows no side panel without outcomes or resources", async () => {
      renderWorkspace();

      await screen.findByText("Tasks");
      expect(screen.queryByText("Resources")).not.toBeInTheDocument();
      expect(screen.queryByText("You’re done when")).not.toBeInTheDocument();
    });

    it("shows outcomes and resources, with a resource's description only when it has one", async () => {
      openStep({ expectedOutcomes: ["Node installed", "Repo cloned"] });
      vi.mocked(onboardingService.fetchResources).mockResolvedValue([
        {
          id: "r1",
          stepId: "step1",
          title: "Node.js",
          description: "Download",
          url: "https://n.dev",
        },
        { id: "r2", stepId: "step1", title: "Git", description: "", url: "https://g.dev" },
      ] as never);
      renderWorkspace();

      expect(await screen.findByText("You’re done when")).toBeInTheDocument();
      expect(screen.getByText("Node installed")).toBeInTheDocument();
      expect(screen.getByText("Repo cloned")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Node.js/ })).toHaveAttribute(
        "href",
        "https://n.dev",
      );
      expect(screen.getByText("Download")).toBeInTheDocument();
      expect(within(screen.getByRole("link", { name: /Git/ })).queryByText("Download")).toBeNull();
    });

    it("shows only the resources when there are no outcomes", async () => {
      vi.mocked(onboardingService.fetchResources).mockResolvedValue([
        { id: "r1", stepId: "step1", title: "Node.js", description: "", url: "https://n.dev" },
      ] as never);
      renderWorkspace();

      expect(await screen.findByText("Resources")).toBeInTheDocument();
      expect(screen.queryByText("You’re done when")).not.toBeInTheDocument();
    });

    it("ticks a task at once and enables completion when the last one is done", async () => {
      vi.mocked(onboardingService.updateTask).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: /Task a/ }));
      expect(screen.getByText("1/2 done")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Task b/ }));

      expect(screen.getByText("2/2 done")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark as complete" })).toBeEnabled();
      expect(onboardingService.updateTask).toHaveBeenCalledTimes(2);
    });

    it("puts a task back and says why when the server refuses", async () => {
      vi.mocked(onboardingService.updateTask).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: /Task a/ }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("offline"));
      expect(screen.getByText("0/2 done")).toBeInTheDocument();
    });

    it("uses a fallback message when the refusal is not an error", async () => {
      vi.mocked(onboardingService.updateTask).mockRejectedValue("x");
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: /Task a/ }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't update the task."),
      );
    });

    it("counts the open tasks on the complete button", async () => {
      renderWorkspace();

      expect(await screen.findByRole("button", { name: "2 tasks to go" })).toBeDisabled();
    });
  });

  describe("starting and completing", () => {
    it("starts a waiting step, tells the page and moves on to completion", async () => {
      openStep({ status: "WAITING" });
      vi.mocked(onboardingService.startStep).mockResolvedValue(undefined);
      const user = userEvent.setup();
      const { props } = renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Start step" }));

      expect(onboardingService.startStep).toHaveBeenCalledWith("step1");
      expect(mocks.flyby).toHaveBeenCalled();
      await waitFor(() => expect(props.onPathChanged).toHaveBeenCalled());
      expect(screen.queryByRole("button", { name: "Start step" })).not.toBeInTheDocument();
      expect(screen.getByText(/· on it for/)).toBeInTheDocument();
    });

    it("says why a start failed and leaves the step waiting", async () => {
      openStep({ status: "WAITING" });
      vi.mocked(onboardingService.startStep).mockRejectedValue(new Error("locked"));
      const user = userEvent.setup();
      const { props } = renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Start step" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("locked"));
      expect(screen.getByRole("button", { name: "Start step" })).toBeEnabled();
      expect(props.onPathChanged).not.toHaveBeenCalled();
      expect(mocks.flyby).not.toHaveBeenCalled();
    });

    it("falls back to a generic message for a start that fails without an error", async () => {
      openStep({ status: "WAITING" });
      vi.mocked(onboardingService.startStep).mockRejectedValue("x");
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Start step" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't start the step."),
      );
    });

    it("completes a step without tasks straight away", async () => {
      vi.mocked(onboardingService.fetchTasks).mockResolvedValue([]);
      vi.mocked(onboardingService.completeStep).mockResolvedValue(undefined);
      const user = userEvent.setup();
      const { props } = renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Mark as complete" }));

      expect(onboardingService.completeStep).toHaveBeenCalledWith("step1");
      expect(await screen.findByText("Done")).toBeInTheDocument();
      expect(props.onPathChanged).toHaveBeenCalled();
    });

    it("says why completing failed and keeps the step open", async () => {
      vi.mocked(onboardingService.fetchTasks).mockResolvedValue([]);
      vi.mocked(onboardingService.completeStep).mockRejectedValue(new Error("denied"));
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Mark as complete" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("denied"));
      expect(screen.queryByText("Done")).not.toBeInTheDocument();
    });

    it("falls back to a generic message for a completion that fails without an error", async () => {
      vi.mocked(onboardingService.fetchTasks).mockResolvedValue([]);
      vi.mocked(onboardingService.completeStep).mockRejectedValue("x");
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Mark as complete" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't complete the step."),
      );
    });

    it("offers to continue from a finished step", async () => {
      openStep({ status: "FINISHED" });
      const user = userEvent.setup();
      const { props } = renderWorkspace();

      expect(await screen.findByText("Done")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Next step" }));

      expect(props.onContinue).toHaveBeenCalled();
    });

    it("calls a skipped step skipped", async () => {
      openStep({ status: "SKIPPED" });
      renderWorkspace();

      expect(await screen.findByText("Skipped")).toBeInTheDocument();
    });
  });

  describe("skip", () => {
    const skipRequest = {
      id: "k1",
      stepId: "step1",
      reason: "Already know it",
      accepted: null,
      reviewComment: null,
      reviewedAt: null,
    };

    it("keeps the request button off until a reason is typed", async () => {
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Skip" }));
      expect(screen.getByRole("button", { name: "Request skip" })).toBeDisabled();

      await user.type(screen.getByLabelText("Reason for skipping"), "  ");
      expect(screen.getByRole("button", { name: "Request skip" })).toBeDisabled();

      await user.type(screen.getByLabelText("Reason for skipping"), "why");
      expect(screen.getByRole("button", { name: "Request skip" })).toBeEnabled();
    });

    it("opens and closes with the Skip button, and with Cancel", async () => {
      const user = userEvent.setup();
      renderWorkspace();

      const toggle = await screen.findByRole("button", { name: "Skip" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText(/Already know this/)).toBeInTheDocument();
      await user.click(toggle);
      expect(screen.queryByLabelText("Reason for skipping")).not.toBeInTheDocument();

      await user.click(toggle);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByLabelText("Reason for skipping")).not.toBeInTheDocument();
    });

    it("sends the trimmed reason, closes the drawer and tells the member", async () => {
      vi.mocked(onboardingService.skipStep).mockResolvedValue({
        id: "k9",
        stepId: "step1",
        reason: "why",
        reviewComment: null,
      } as never);
      const user = userEvent.setup();
      const { props } = renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Skip" }));
      await user.type(screen.getByLabelText("Reason for skipping"), "  why  ");
      await user.click(screen.getByRole("button", { name: "Request skip" }));

      expect(onboardingService.skipStep).toHaveBeenCalledWith(
        expect.objectContaining({ id: "step1" }),
        "why",
      );
      await waitFor(() =>
        expect(mocks.toast.success).toHaveBeenCalledWith(
          "Skip request sent to your project manager",
        ),
      );
      expect(props.onPathChanged).toHaveBeenCalled();
      expect(screen.queryByLabelText("Reason for skipping")).not.toBeInTheDocument();
      expect(screen.getByText("Skip requested", { selector: "span.font-semibold" })).toBeVisible();
    });

    it("says why a request failed and keeps the drawer and the reason", async () => {
      vi.mocked(onboardingService.skipStep).mockRejectedValue(new Error("too late"));
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Skip" }));
      await user.type(screen.getByLabelText("Reason for skipping"), "why");
      await user.click(screen.getByRole("button", { name: "Request skip" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("too late"));
      expect(screen.getByLabelText("Reason for skipping")).toHaveValue("why");
    });

    it("falls back to a generic message for a request that fails without an error", async () => {
      vi.mocked(onboardingService.skipStep).mockRejectedValue("x");
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Skip" }));
      await user.type(screen.getByLabelText("Reason for skipping"), "why");
      await user.click(screen.getByRole("button", { name: "Request skip" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't send the skip request."),
      );
    });

    it("shows a pending request with its reason and keeps the step workable", async () => {
      openStep({ skip: skipRequest });
      renderWorkspace();

      expect(await screen.findByText(/your project manager decides\./)).toBeInTheDocument();
      expect(screen.getByText("“Already know it”")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Skip requested" })).toBeDisabled();
    });

    it("shows an approved request with the manager's comment", async () => {
      openStep({ skip: { ...skipRequest, accepted: true, reviewComment: "Fine by me" } });
      renderWorkspace();

      expect(await screen.findByText("Skip approved")).toBeInTheDocument();
      expect(screen.getByText("“Fine by me”")).toBeInTheDocument();
    });

    it("shows an approved request without a comment", async () => {
      openStep({ skip: { ...skipRequest, accepted: true } });
      renderWorkspace();

      expect(await screen.findByText("Skip approved")).toBeInTheDocument();
      expect(screen.queryByText(/^“/)).not.toBeInTheDocument();
    });

    it("shows a declined request with the manager's comment", async () => {
      openStep({ skip: { ...skipRequest, accepted: false, reviewComment: "Please do it" } });
      renderWorkspace();

      expect(await screen.findByText("Skip declined")).toBeInTheDocument();
      expect(screen.getByText("“Please do it”")).toBeInTheDocument();
    });

    it("shows a declined request without a comment", async () => {
      openStep({ skip: { ...skipRequest, accepted: false } });
      renderWorkspace();

      expect(await screen.findByText("Skip declined")).toBeInTheDocument();
      expect(screen.queryByText(/^“/)).not.toBeInTheDocument();
    });

    it("shows no notice for a declined request on a step that ended up skipped", async () => {
      openStep({ status: "SKIPPED", skip: { ...skipRequest, accepted: false } });
      renderWorkspace();

      await screen.findByText("Skipped");
      expect(screen.queryByText("Skip declined")).not.toBeInTheDocument();
    });
  });

  describe("feedback", () => {
    it("keeps sending off until both a choice and a comment are given", async () => {
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Feedback" }));
      const send = screen.getByRole("button", { name: "Send feedback" });
      expect(send).toBeDisabled();

      await user.type(screen.getByLabelText("Feedback comment"), "Clear steps");
      expect(send).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Helpful" }));
      expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Not helpful" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(send).toBeEnabled();
    });

    it("sends a negative answer, thanks the member and keeps the answer on show", async () => {
      vi.mocked(onboardingService.submitFeedback).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Feedback" }));
      await user.click(screen.getByRole("button", { name: "Not helpful" }));
      await user.type(screen.getByLabelText("Feedback comment"), "Too vague");
      await user.click(screen.getByRole("button", { name: "Send feedback" }));

      expect(onboardingService.submitFeedback).toHaveBeenCalledWith("step1", false, "Too vague");
      await waitFor(() =>
        expect(mocks.toast.success).toHaveBeenCalledWith("Thanks for the feedback"),
      );
      expect(screen.queryByLabelText("Feedback comment")).not.toBeInTheDocument();
      expect(screen.getByText("You found this step not helpful")).toBeInTheDocument();
      expect(screen.getByText("“Too vague”")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit feedback" })).toBeInTheDocument();
    });

    it("sends a positive answer", async () => {
      vi.mocked(onboardingService.submitFeedback).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Feedback" }));
      await user.click(screen.getByRole("button", { name: "Helpful" }));
      await user.type(screen.getByLabelText("Feedback comment"), "Great");
      await user.click(screen.getByRole("button", { name: "Send feedback" }));

      expect(onboardingService.submitFeedback).toHaveBeenCalledWith("step1", true, "Great");
      expect(await screen.findByText("You found this step helpful")).toBeInTheDocument();
    });

    it("says why sending failed and keeps the drawer open", async () => {
      vi.mocked(onboardingService.submitFeedback).mockRejectedValue(new Error("busy"));
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Feedback" }));
      await user.click(screen.getByRole("button", { name: "Helpful" }));
      await user.type(screen.getByLabelText("Feedback comment"), "Great");
      await user.click(screen.getByRole("button", { name: "Send feedback" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("busy"));
      expect(screen.getByLabelText("Feedback comment")).toHaveValue("Great");
    });

    it("falls back to a generic message for a send that fails without an error", async () => {
      vi.mocked(onboardingService.submitFeedback).mockRejectedValue("x");
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Feedback" }));
      await user.click(screen.getByRole("button", { name: "Helpful" }));
      await user.type(screen.getByLabelText("Feedback comment"), "Great");
      await user.click(screen.getByRole("button", { name: "Send feedback" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't send your feedback."),
      );
    });

    it("shows feedback given earlier, hides it while the drawer is open and prefills it", async () => {
      openStep({ feedback: { helpful: true, comment: "Loved it" } });
      const user = userEvent.setup();
      renderWorkspace();

      expect(await screen.findByText("You found this step helpful")).toBeInTheDocument();
      expect(screen.getByText("“Loved it”")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Edit feedback" }));

      expect(screen.queryByText("You found this step helpful")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Feedback comment")).toHaveValue("Loved it");
      expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("switches from the skip drawer to the feedback drawer", async () => {
      const user = userEvent.setup();
      renderWorkspace();

      await user.click(await screen.findByRole("button", { name: "Skip" }));
      await user.click(screen.getByRole("button", { name: "Feedback" }));

      expect(screen.queryByLabelText("Reason for skipping")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Feedback comment")).toBeInTheDocument();
    });
  });
});
