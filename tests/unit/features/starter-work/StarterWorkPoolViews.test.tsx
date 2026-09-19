import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import { mockViewport } from "../../setup/matchMedia";
import { renderWithProviders } from "../../setup/test-utils";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
      }),
  };
});

function task(index: number): StarterWorkTask {
  return {
    id: `task-${index}`,
    sourceId: `github:acme/repo:ISSUE:${index}`,
    title: `Starter task ${index}`,
    summary: `A clearly scoped task number ${index}.`,
    rationale: null,
    sourceUrl: `https://github.com/acme/repo/issues/${index}`,
    competencyKeys: ["react", "testing"],
    status: "LIVE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: null,
  };
}

describe("StarterWorkPoolCloud views", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    // The pool offers its cloud view from `sm` up, so pin a desktop viewport for these view tests.
    mockViewport();
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
  });

  it("shows the repo and issue number as a coloured source badge", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    const sourceBadge = screen.getByText("#1");
    expect(sourceBadge.closest("[title]")).toHaveAttribute("title", "acme/repo #1");

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.getByTestId("pool-task-list")).toBeInTheDocument();
    expect(screen.queryByTestId("pool-task-cloud")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses the full list-row surface as the detail-drawer trigger", async () => {
    const user = userEvent.setup();
    const onOpenTask = vi.fn();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={onOpenTask}
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));
    const rowTrigger = screen.getByRole("button", {
      name: "Open details for Starter task 1",
    });
    expect(rowTrigger).toHaveClass("absolute", "inset-0");

    await user.click(rowTrigger);

    expect(onOpenTask).toHaveBeenCalledWith(task(1));
  });

  it("marks an unseen task with a dashed row and a dot in list view too", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[{ ...task(1), reviewed: false }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));

    const row = screen.getByTestId("pool-list-task-task-1");
    expect(row.querySelector(".border-dashed")).toBeInTheDocument();
    expect(within(row).getByLabelText("Not looked at yet")).toBeInTheDocument();
  });
});
