import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ProjectIndustryWidget } from "../../../../../src/features/projects/industry/ProjectIndustryWidget";
import { createProjectContextValue, createSelectableProject } from "../../../setup/projectContext";

vi.mock("../../../../../src/services/projectService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: {
      ...actual.projectService,
      getAccessibleProject: vi.fn(),
      evaluateProjectIndustry: vi.fn(),
    },
  };
});

const reloadProjects = vi.fn();
let contextOverrides: Record<string, unknown> = {};

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    ...createProjectContextValue({
      selectedProjectId: "proj-1",
      selectedProject: createSelectableProject({ id: "proj-1", isManaged: true }),
      reloadProjects,
    }),
    ...contextOverrides,
  }),
}));

let authProfile: { permissionGroup: string } | null = { permissionGroup: "PM" };

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: authProfile }),
}));

const render = () => rtlRender(<ProjectIndustryWidget />, { wrapper: ToastProvider });

function projectDetails(
  overrides: Partial<{
    industry: string;
    industryConfidence: "high" | "medium" | "low" | null;
  }> = {},
) {
  return {
    id: "proj-1",
    name: "Alpha",
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    ...overrides,
  };
}

describe("ProjectIndustryWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextOverrides = {};
    authProfile = { permissionGroup: "PM" };
  });

  it("shows a loading state while the project is being fetched", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockReturnValue(new Promise(() => {}));

    render();

    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows an error message when the project fails to load", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockRejectedValue(new Error("Network down"));

    render();

    await waitFor(() => expect(screen.getByText("Network down")).toBeInTheDocument());
  });

  it("shows the industry once loaded", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockResolvedValue(
      projectDetails({ industry: "Fintech", industryConfidence: "high" }),
    );

    render();

    await waitFor(() =>
      expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Fintech"),
    );
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("allows evaluation for the project's manager", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockResolvedValue(projectDetails());
    contextOverrides = {
      selectedProject: createSelectableProject({ id: "proj-1", isManaged: true }),
    };
    authProfile = { permissionGroup: "PM" };

    render();

    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).toBeInTheDocument(),
    );
  });

  it("hides evaluation for a PM who does not manage the selected project", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockResolvedValue(projectDetails());
    contextOverrides = {
      selectedProject: createSelectableProject({ id: "proj-1", isManaged: false }),
    };
    authProfile = { permissionGroup: "PM" };

    render();

    await waitFor(() => expect(screen.getByTestId("project-industry-value")).toBeInTheDocument());
    expect(screen.queryByTestId("reevaluate-industry-button")).not.toBeInTheDocument();
  });

  it("hides evaluation for HR", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockResolvedValue(projectDetails());
    contextOverrides = {
      selectedProject: createSelectableProject({ id: "proj-1", isManaged: false }),
    };
    authProfile = { permissionGroup: "HR" };

    render();

    await waitFor(() => expect(screen.getByTestId("project-industry-value")).toBeInTheDocument());
    expect(screen.queryByTestId("reevaluate-industry-button")).not.toBeInTheDocument();
  });

  it("allows evaluation for an admin regardless of the manager assignment", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject).mockResolvedValue(projectDetails());
    contextOverrides = {
      selectedProject: createSelectableProject({ id: "proj-1", isManaged: false }),
    };
    authProfile = { permissionGroup: "ADMIN" };

    render();

    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).toBeInTheDocument(),
    );
  });

  it("reloads the project after a successful evaluation", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject)
      .mockResolvedValueOnce(projectDetails())
      .mockResolvedValueOnce(
        projectDetails({ industry: "Healthcare", industryConfidence: "medium" }),
      );
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: [],
    });

    const user = userEvent.setup();
    render();

    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Healthcare"),
    );
    expect(vi.mocked(projectService.getAccessibleProject)).toHaveBeenCalledTimes(2);
  });

  it("does not reload the global project list, which would unmount the route's skeleton guard mid-evaluation", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject)
      .mockResolvedValueOnce(projectDetails())
      .mockResolvedValueOnce(
        projectDetails({ industry: "Healthcare", industryConfidence: "medium" }),
      );
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: [],
    });

    const user = userEvent.setup();
    render();

    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Healthcare"),
    );
    expect(reloadProjects).not.toHaveBeenCalled();
  });

  it("keeps the evaluation's evidence available (behind the collapsed toggle) after the post-evaluate reload", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.getAccessibleProject)
      .mockResolvedValueOnce(projectDetails())
      .mockResolvedValueOnce(
        projectDetails({ industry: "Healthcare", industryConfidence: "medium" }),
      );
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Healthcare",
      confidence: "medium",
      evidence: ["Mentions patient records", "References clinical workflows"],
    });

    const user = userEvent.setup();
    render();

    await waitFor(() =>
      expect(screen.getByTestId("reevaluate-industry-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("reevaluate-industry-button"));

    await waitFor(() =>
      expect(screen.getByTestId("project-industry-value")).toHaveTextContent("Healthcare"),
    );

    // Collapsed by default on the PM Dashboard; expanding it reveals the evidence.
    expect(screen.queryByText("Mentions patient records")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show evidence (2)" }));
    expect(screen.getByText("Mentions patient records")).toBeInTheDocument();
    expect(screen.getByText("References clinical workflows")).toBeInTheDocument();
  });

  it("renders nothing when no project is selected", () => {
    contextOverrides = { selectedProjectId: "" };

    const { container } = render();

    expect(container).toBeEmptyDOMElement();
  });
});
