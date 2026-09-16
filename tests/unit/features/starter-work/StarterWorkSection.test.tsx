import { render as testingRender, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarterWorkSection } from "../../../../src/features/starter-work/components/StarterWorkSection";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import { orientationService } from "../../../../src/services/orientationService";
import { userService } from "../../../../src/services/userService";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

const selectedProjectId = vi.hoisted(() => ({ current: "p1" }));

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: selectedProjectId.current,
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

const emptyOrientation = {
  taskId: "task-1",
  taskTitle: "Fix the login redirect",
  taskUrl: null,
  packet: null,
  reason: null,
};

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
  taskZeroEligible: false,
};

describe("StarterWorkSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permissionGroup.current = "PM";
    selectedProjectId.current = "p1";
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [task] });
    // The overview shows the whole pool, which by default just holds the one unreviewed task.
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([task]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
    // The page also renders the corpus issue browser, which reads the selected project's
    // ingested issues. Its own behaviour is covered in CorpusIssueBrowser.test.tsx.
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(orientationService, "fetchTaskOrientation").mockResolvedValue(emptyOrientation);
  });

  it("shows every live pool task in the overview, and how many are still unreviewed", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([
      task,
      { ...task, id: "task-2", title: "Document the auth flow" },
    ]);
    render(<StarterWorkSection />);

    // Only "task" (task-1) is also in the unreviewed queue (the default `fetchUnreviewed` mock),
    // so the hint counts it alone even though the pool itself holds both.
    expect(await screen.findByTestId("unreviewed-hint")).toHaveTextContent(
      "1 task nobody has looked at yet",
    );
    const pool = await screen.findByTestId("starter-work-pool");
    expect(within(pool).getByText("Fix the login redirect")).toBeInTheDocument();
    expect(within(pool).getByText("Document the auth flow")).toBeInTheDocument();
  });

  it("opens a pool task's detail drawer, showing its rationale and competencies", async () => {
    const user = userEvent.setup();
    render(<StarterWorkSection />);

    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );

    expect(
      await screen.findByText(/touches one file and has clear acceptance criteria/i),
    ).toBeInTheDocument();
    expect(screen.getByText("kotlin")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const overlay = screen
      .getAllByRole("button", { name: "Close details" })
      .find((button) => !dialog.contains(button));
    expect(overlay).toHaveClass("bg-app-overlay", "opacity-100");
  });

  it("approves through the service and closes the drawer", async () => {
    const user = userEvent.setup();
    const approve = vi
      .spyOn(starterWorkService, "markReviewed")
      .mockResolvedValue({ ...task, status: "LIVE", reviewed: true });
    render(<StarterWorkSection />);

    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );
    await user.click(await screen.findByTestId("approve-task-task-1"));

    await waitFor(() => expect(approve).toHaveBeenCalledWith("task-1"));
    await waitFor(() =>
      expect(screen.queryByTestId("approve-task-task-1")).not.toBeInTheDocument(),
    );
  });

  it("flags a task for Task 0 from the drawer", async () => {
    const user = userEvent.setup();
    const setTaskZero = vi
      .spyOn(starterWorkService, "setTaskZero")
      .mockResolvedValue({ ...task, taskZeroEligible: true });
    render(<StarterWorkSection />);

    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );
    await user.click(await screen.findByRole("switch", { name: "Use as Task 0" }));

    await waitFor(() => expect(setTaskZero).toHaveBeenCalledWith("task-1", true));
  });

  it("opens the existing orientation editor from the drawer", async () => {
    const user = userEvent.setup();
    render(<StarterWorkSection />);

    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Write orientation" }));

    expect(await screen.findByTestId("orientation-editor")).toBeInTheDocument();
  });

  it("offers the overview, pool and issues sections and no orientation or review tab", async () => {
    const user = userEvent.setup();
    render(<StarterWorkSection />);

    const tabs = await screen.findByRole("group", { name: "Filter sections" });
    expect(within(tabs).getByText("Overview")).toBeInTheDocument();
    expect(within(tabs).getByText("Pool")).toBeInTheDocument();
    expect(within(tabs).getByText("Issues")).toBeInTheDocument();
    expect(within(tabs).queryByText("Review")).not.toBeInTheDocument();
    expect(within(tabs).queryByText("Orientation")).not.toBeInTheDocument();

    // The pool section stands on its own under the Pool tab, without the issue browser beside it.
    await user.click(within(tabs).getByText("Pool"));
    expect(await screen.findByTestId("starter-work-pool")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("corpus-issue-browser")).not.toBeInTheDocument(),
    );
  });

  it("lets HR read a task's drawer but not decide on it", async () => {
    permissionGroup.current = "HR";
    const user = userEvent.setup();
    render(<StarterWorkSection />);

    await user.click(
      await screen.findByRole("button", { name: /open details for fix the login redirect/i }),
    );

    expect(
      await screen.findByText(/touches one file and has clear acceptance criteria/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("approve-task-task-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-task-task-1")).not.toBeInTheDocument();
  });

  it("hides the hint banner once nothing is unreviewed", async () => {
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    render(<StarterWorkSection />);

    await screen.findByTestId("starter-work-pool");
    expect(screen.queryByTestId("unreviewed-hint")).not.toBeInTheDocument();
    expect(screen.queryByTestId("open-triage")).not.toBeInTheDocument();
  });

  it("goes through the unreviewed queue via the triage modal, keeping only decided tasks in the tally", async () => {
    const user = userEvent.setup();
    const secondTask = { ...task, id: "task-2", title: "Second task" };
    const thirdTask = { ...task, id: "task-3", title: "Third task" };
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({
      tasks: [task, secondTask, thirdTask],
    });
    const approve = vi
      .spyOn(starterWorkService, "markReviewed")
      .mockResolvedValue({ ...task, reviewed: true });
    const reject = vi.spyOn(starterWorkService, "reject").mockResolvedValue(thirdTask);
    render(<StarterWorkSection />);

    await user.click(await screen.findByTestId("open-triage"));
    const triage = await screen.findByTestId("starter-work-triage");
    expect(within(triage).getByText("Fix the login redirect")).toBeInTheDocument();

    // Skipping the first task does not decide it, and does not count toward the closing tally.
    await user.click(within(triage).getByTestId("triage-later"));
    expect(await within(triage).findByText("Second task")).toBeInTheDocument();

    await user.click(within(triage).getByTestId("triage-approve"));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("task-2"));
    expect(await within(triage).findByText("Third task")).toBeInTheDocument();

    await user.click(within(triage).getByTestId("triage-remove"));
    await waitFor(() => expect(reject).toHaveBeenCalledWith("task-3", undefined));

    expect(await within(triage).findByText("All caught up")).toBeInTheDocument();
    expect(within(triage).getByText(/you looked at 2 tasks/i)).toBeInTheDocument();
  });

  it("shows generated work as a success toast", async () => {
    const generateSpy = vi.spyOn(starterWorkService, "generate").mockResolvedValue({
      status: "COMPLETED",
      tasksProposed: 2,
      notes: [],
    });
    const user = userEvent.setup();
    render(<StarterWorkSection />);

    await user.click(await screen.findByTestId("generate-starter-work"));

    expect(await screen.findByText("2 tasks added")).toBeInTheDocument();
    expect(generateSpy).toHaveBeenCalledWith("p1");
  });

  it("disables mining without a selected project", async () => {
    selectedProjectId.current = "";
    render(<StarterWorkSection />);

    expect(await screen.findByTestId("generate-starter-work")).toBeDisabled();
  });

  it("surfaces a failed load", async () => {
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockRejectedValue(new Error("boom"));
    render(<StarterWorkSection />);

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
    render(<StarterWorkSection />);

    await user.click(await screen.findByTestId("add-starter-task"));
    await user.type(screen.getByLabelText("Title"), "Add a dark-mode toggle");
    await user.click(screen.getByTestId("create-starter-task"));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Add a dark-mode toggle" }),
      ),
    );
    expect(await screen.findByText("Task created")).toBeInTheDocument();
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
    render(<StarterWorkSection />);

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
    render(<StarterWorkSection />);

    expect(await screen.findByText("Tidy the onboarding README")).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:7")).not.toBeInTheDocument();
  });

  it("does not offer hand-authoring to HR", async () => {
    permissionGroup.current = "HR";
    render(<StarterWorkSection />);

    await screen.findByTestId("starter-work-pool");
    expect(screen.queryByTestId("add-starter-task")).not.toBeInTheDocument();
  });
});
