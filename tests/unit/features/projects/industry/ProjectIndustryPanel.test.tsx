import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ProjectIndustryPanel } from "../../../../../src/features/projects/industry/ProjectIndustryPanel";
import { ApiError } from "../../../../../src/services/apiClient";

vi.mock("../../../../../src/services/projectService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: { ...actual.projectService, evaluateProjectIndustry: vi.fn() },
  };
});

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

function toastStack() {
  return screen.getByRole("list", { name: "Notifications" });
}

const onEvaluated = vi.fn();

describe("ProjectIndustryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the empty state when no industry is set", () => {
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate={false}
        onEvaluated={onEvaluated}
      />,
    );

    expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Not determined yet");
  });

  it("shows the industry value and confidence badge", () => {
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry="Fintech"
        industryConfidence="high"
        canEvaluate={false}
        onEvaluated={onEvaluated}
      />,
    );

    expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Fintech");
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("hides the re-evaluate button when canEvaluate is false", () => {
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate={false}
        onEvaluated={onEvaluated}
      />,
    );

    expect(screen.queryByTestId("reevaluate-industry-button")).not.toBeInTheDocument();
  });

  it("evaluates immediately (no confirmation) when no industry is set yet", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: ["Mentions patient records"],
    });

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(projectService.evaluateProjectIndustry).toHaveBeenCalledWith("proj-1"),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(within(toastStack()).getByText('Industry set to "Healthcare"')).toBeInTheDocument(),
    );
    expect(onEvaluated).toHaveBeenCalledWith({
      industry: "Healthcare",
      confidence: "medium",
      evidence: ["Mentions patient records"],
    });
    expect(screen.getByText("Mentions patient records")).toBeInTheDocument();
  });

  it("asks for confirmation before overwriting an already-set industry", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Fintech",
      confidence: "high",
      evidence: [],
    });

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry="Fintech"
        industryConfidence="high"
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    const dialog = await screen.findByRole("alertdialog");
    expect(projectService.evaluateProjectIndustry).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Re-evaluate" }));

    await waitFor(() =>
      expect(projectService.evaluateProjectIndustry).toHaveBeenCalledWith("proj-1"),
    );
  });

  it("does not evaluate when the confirmation is cancelled", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry="Fintech"
        industryConfidence="high"
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(projectService.evaluateProjectIndustry).not.toHaveBeenCalled();
  });

  it("shows an info toast instead of a success toast for an empty result", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "",
      confidence: "low",
      evidence: [],
    });

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(
        within(toastStack()).getByText("No industry could be detected from the ingested sources"),
      ).toBeInTheDocument(),
    );
    expect(onEvaluated).toHaveBeenCalledWith({ industry: "", confidence: "low", evidence: [] });
  });

  it("shows an error toast when the evaluation fails", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockRejectedValue(
      new ApiError(502, "Bad Gateway"),
    );

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(
        within(toastStack()).getByText("AI service unavailable. Try again in a moment."),
      ).toBeInTheDocument(),
    );
    expect(onEvaluated).not.toHaveBeenCalled();
  });

  it("disables the button while an evaluation is in flight", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    let resolveCall: (value: {
      industry: string;
      confidence: "low";
      evidence: string[];
    }) => void = () => {};
    vi.mocked(projectService.evaluateProjectIndustry).mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() => expect(screen.getByTestId("reevaluate-industry-button")).toBeDisabled());

    resolveCall({ industry: "", confidence: "low", evidence: [] });
    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).not.toBeDisabled(),
    );
  });

  it("shows the evidence list outright by default (collapsibleEvidence unset)", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: ["Mentions patient records"],
    });

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() => expect(screen.getByText("Mentions patient records")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /show evidence/i })).not.toBeInTheDocument();
  });

  it("hides the evidence list behind a toggle when collapsibleEvidence is set", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: ["Mentions patient records", "References clinical workflows"],
    });

    const user = userEvent.setup();
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        collapsibleEvidence
        onEvaluated={onEvaluated}
      />,
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    const toggle = await screen.findByRole("button", { name: "Show evidence (2)" });
    expect(screen.queryByText("Mentions patient records")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByText("Mentions patient records")).toBeInTheDocument();
    expect(screen.getByText("References clinical workflows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide evidence" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Hide evidence" }));
    expect(screen.queryByText("Mentions patient records")).not.toBeInTheDocument();
  });

  it("disables the button when the disabled prop is set", () => {
    render(
      <ProjectIndustryPanel
        projectId="proj-1"
        industry=""
        industryConfidence={null}
        canEvaluate
        disabled
        onEvaluated={onEvaluated}
      />,
    );

    expect(screen.getByTestId("reevaluate-industry-button")).toBeDisabled();
  });
});
