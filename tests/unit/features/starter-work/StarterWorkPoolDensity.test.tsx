import { screen } from "@testing-library/react";
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
    summary: null,
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

describe("StarterWorkPoolCloud density", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    // The cloud view only exists from `sm` up, so pin a desktop viewport.
    mockViewport();
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
  });

  it("lays the list out as a single grouped list of up to ten rows per page", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 11 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));

    const list = screen.getByTestId("pool-task-list");
    expect(list).toHaveClass("divide-y");
    const rows = screen.getAllByTestId(/^pool-list-task-/);
    expect(rows).toHaveLength(10);
    expect(screen.queryByText("Starter task 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Starter task 11")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^pool-list-task-/)).toHaveLength(1);
  });

  it("shows a 4×3 grid of up to twelve cards per cloud page", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 13 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    // Cloud view is the default.
    expect(screen.getAllByTestId(/^pool-task-task-/)).toHaveLength(12);
    expect(screen.queryByText("Starter task 13")).not.toBeInTheDocument();
  });

  it("does not render competency badges in either pool view", async () => {
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

    expect(screen.queryByText("react")).not.toBeInTheDocument();
    expect(screen.queryByText("testing")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.queryByText("react")).not.toBeInTheDocument();
    expect(screen.queryByText("testing")).not.toBeInTheDocument();
  });

  it("returns to the first page when a filter narrows a later page down", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        // Only the first task is flagged for Task 0; the other ten fill up the list's first
        // page (10 per page), pushing it onto page 2.
        tasks={Array.from({ length: 11 }, (_, index) =>
          index === 0 ? { ...task(1), taskZeroEligible: true } : task(index + 1),
        )}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Starter task 11")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Task 0/ }));

    // Page 2 no longer exists once the filter leaves a single match — the view lands back on
    // page 1 and shows it, rather than a blank page 2.
    expect(await screen.findByText("Starter task 1")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 11")).not.toBeInTheDocument();
  });
});
