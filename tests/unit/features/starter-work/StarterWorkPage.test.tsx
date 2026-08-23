import { render as testingRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarterWorkPage } from "../../../../src/pages/StarterWorkPage";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import { userService } from "../../../../src/services/userService";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "p1", name: "Project One" }),
      }),
  };
});

const permissionGroup = vi.hoisted(() => ({ current: "PM" }));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u1", permissionGroup: permissionGroup.current } }),
}));

function render(ui: ReactElement) {
  return testingRender(<ToastProvider>{ui}</ToastProvider>);
}

const task: StarterWorkTask = {
  id: "task-1",
  sourceId: "github:acme/repo:ISSUE:42",
  title: "Fix the login redirect",
  summary: "Users land on the wrong page after signing in.",
  rationale: "Touches one file and has clear acceptance criteria.",
  sourceUrl: "https://github.com/acme/repo/issues/42",
  competencyKeys: ["kotlin", "auth"],
  status: "LIVE",
  reviewed: false,
};

describe("StarterWorkPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permissionGroup.current = "PM";
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [task] });
    // The PM page also renders the task-orientation manager, which loads the approved pool and
    // the caller's projects. Stub both so these tests stay about the review queue.
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
    // The page also renders the corpus issue browser, which reads the selected project's
    // ingested issues. Its own behaviour is covered in CorpusIssueBrowser.test.tsx.
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
  });

  it("summarizes the live pool and its reviewed work", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([
      task,
      { ...task, id: "task-2", title: "Document the auth flow", reviewed: true },
    ]);
    render(<StarterWorkPage />);

    const poolCard = (await screen.findByText("Available to new hires")).parentElement;
    const reviewedCard = screen.getByText("Vouched for by your team").parentElement;

    expect(poolCard).toHaveTextContent("In the pool");
    expect(poolCard).toHaveTextContent("2");
    expect(reviewedCard).toHaveTextContent("Reviewed");
    expect(reviewedCard).toHaveTextContent("1");
    expect(screen.queryByText("Skills exercised")).not.toBeInTheDocument();
    expect(screen.queryByText("Linked to a source")).not.toBeInTheDocument();
  });

  it("shows the AI scope-safety rationale in the task detail", async () => {
    const user = userEvent.setup();
    render(<StarterWorkPage />);

    // The list stays compact; the rationale — the claim a PM is checking — opens with the detail.
    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );

    expect(
      await screen.findByText(/touches one file and has clear acceptance criteria/i),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const overlay = screen
      .getAllByRole("button", { name: "Close details" })
      .find((button) => !dialog.contains(button));
    expect(overlay).toHaveClass("bg-app-overlay", "opacity-100");
  });

  it("lists the competencies that become prerequisites", async () => {
    render(<StarterWorkPage />);

    await screen.findByText("Fix the login redirect");
    expect(screen.getByText("kotlin")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();
  });

  it("approves through the service and drops the task from the queue", async () => {
    const user = userEvent.setup();
    const approve = vi
      .spyOn(starterWorkService, "markReviewed")
      .mockResolvedValue({ ...task, status: "LIVE", reviewed: true });
    render(<StarterWorkPage />);

    await user.click(await screen.findByTestId("approve-task-task-1"));

    await waitFor(() => expect(approve).toHaveBeenCalledWith("task-1"));
    await waitFor(() =>
      expect(screen.queryByTestId("approve-task-task-1")).not.toBeInTheDocument(),
    );
  });

  it("lets HR read the queue but not decide on it", async () => {
    permissionGroup.current = "HR";
    render(<StarterWorkPage />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.queryByTestId("approve-task-task-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-task-task-1")).not.toBeInTheDocument();
  });

  it("hides the overview review section and expands the pool when no reviews are open", async () => {
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    render(<StarterWorkPage />);

    await waitFor(() =>
      expect(screen.queryByTestId("overview-review-column")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/nothing here needs a look/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("overview-pool-column")).toHaveClass("xl:col-span-2");
  });

  it("shows generated work as a success toast", async () => {
    vi.spyOn(starterWorkService, "generate").mockResolvedValue({
      status: "COMPLETED",
      tasksProposed: 2,
      notes: [],
    });
    const user = userEvent.setup();
    render(<StarterWorkPage />);

    await user.click(await screen.findByTestId("generate-starter-work"));

    expect(await screen.findByText("2 tasks added")).toBeInTheDocument();
  });

  it("surfaces a failed load", async () => {
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockRejectedValue(new Error("boom"));
    render(<StarterWorkPage />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("hand-authors a task through the service and confirms it skipped review", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(starterWorkService, "create").mockResolvedValue({
      ...task,
      id: "authored-1",
      title: "Add a dark-mode toggle",
      status: "LIVE",
      reviewed: true,
    });
    render(<StarterWorkPage />);

    await user.click(await screen.findByTestId("add-starter-task"));
    await user.type(screen.getByLabelText("Title"), "Add a dark-mode toggle");
    await user.click(screen.getByTestId("create-starter-task"));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Add a dark-mode toggle" }),
      ),
    );
    expect(await screen.findByText("Added to pool")).toBeInTheDocument();
    expect(screen.getAllByText("Add a dark-mode toggle").length).toBeGreaterThan(0);
  });

  /**
   * The picker and the blank form land in the same place, and the confirmation says which one
   * happened — "you wrote it" would be wrong about an issue somebody picked out of the corpus.
   */
  it("confirms a picked issue where a written one is confirmed, in its own words", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      {
        sourceId: "github:acme/repo:ISSUE:7",
        tracker: "GITHUB",
        title: "Tidy the onboarding README",
        excerpt: null,
        excerptTruncated: false,
        labels: [],
        sourceUrl: null,
        hasAssignee: null,
        poolState: "AVAILABLE",
        updatedAtSource: null,
      },
    ]);
    vi.spyOn(starterWorkService, "promoteCandidate").mockResolvedValue({
      ...task,
      id: "picked-1",
      title: "Tidy the onboarding README",
      reviewed: true,
    });
    const user = userEvent.setup();
    render(<StarterWorkPage />);

    // The row is compact and opens a drawer; the add action lives in that drawer's footer.
    await user.click(
      await screen.findByRole("button", { name: /open tidy the onboarding readme/i }),
    );
    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:7"));

    expect(await screen.findByText("Added to pool")).toBeInTheDocument();
    expect(screen.getAllByText("Tidy the onboarding README").length).toBeGreaterThan(0);
  });

  it("lets HR read the issue browser but not add from it", async () => {
    permissionGroup.current = "HR";
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      {
        sourceId: "github:acme/repo:ISSUE:7",
        tracker: "GITHUB",
        title: "Tidy the onboarding README",
        excerpt: null,
        excerptTruncated: false,
        labels: [],
        sourceUrl: null,
        hasAssignee: null,
        poolState: "AVAILABLE",
        updatedAtSource: null,
      },
    ]);
    render(<StarterWorkPage />);

    expect(await screen.findByText("Tidy the onboarding README")).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:7")).not.toBeInTheDocument();
  });

  it("does not offer hand-authoring to HR", async () => {
    permissionGroup.current = "HR";
    render(<StarterWorkPage />);

    await screen.findByText("Fix the login redirect");
    expect(screen.queryByTestId("add-starter-task")).not.toBeInTheDocument();
  });
});
