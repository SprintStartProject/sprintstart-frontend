import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarterWorkPage } from "../../../../src/pages/StarterWorkPage";
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

  it("shows the AI scope-safety rationale next to the task", async () => {
    render(<StarterWorkPage />);

    // The rationale is the claim a PM is checking, so it has to be visible before deciding.
    expect(
      await screen.findByText(/touches one file and has clear acceptance criteria/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Fix the login redirect")).toBeInTheDocument();
  });

  it("lists the competencies that become prerequisites", async () => {
    render(<StarterWorkPage />);

    await screen.findByText("Fix the login redirect");
    expect(screen.getByText("kotlin")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();
  });

  it("says a hire can already claim it, so review does not read as a gate", async () => {
    render(<StarterWorkPage />);

    await screen.findByText("Fix the login redirect");
    expect(screen.getByText(/hires can already claim this/i)).toBeInTheDocument();
    // Removal is the irreversible half, and it is sticky -- worth saying before it is clicked.
    expect(screen.getByText(/mining will not bring it back/i)).toBeInTheDocument();
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
      expect(screen.queryByText("Fix the login redirect")).not.toBeInTheDocument(),
    );
  });

  it("lets HR read the queue but not decide on it", async () => {
    permissionGroup.current = "HR";
    render(<StarterWorkPage />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.queryByTestId("approve-task-task-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-task-task-1")).not.toBeInTheDocument();
  });

  it("explains an empty list as nothing to look at, not nothing done", async () => {
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    render(<StarterWorkPage />);

    expect(await screen.findByText(/nothing here needs a look/i)).toBeInTheDocument();
    expect(screen.getByText(/not a queue blocking anybody/i)).toBeInTheDocument();
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
    // Born approved, so it never joins the queue — the page says so rather than losing it.
    expect(await screen.findByTestId("created-task-confirmation")).toHaveTextContent(
      /add a dark-mode toggle/i,
    );
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

    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:7"));

    const confirmation = await screen.findByTestId("created-task-confirmation");
    expect(confirmation).toHaveTextContent(/tidy the onboarding readme/i);
    expect(confirmation).toHaveTextContent(/you picked it/i);
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
