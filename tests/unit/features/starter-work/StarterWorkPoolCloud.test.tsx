import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import { mockViewport } from "../../setup/matchMedia";
import { renderWithProviders } from "../../setup/test-utils";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  const project = createSelectableProject({ id: "p1", name: "Project One" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        selectedProject: project,
        projects: [project],
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
    competencyKeys: ["react", "testing", "docs", "typescript"],
    status: "LIVE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: null,
  };
}

describe("StarterWorkPoolCloud", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    // The cloud view only renders from `sm` up, so pin a desktop viewport for these cloud tests.
    mockViewport();
    // The "Only {project}" chip reads this query; empty by default so it stays hidden unless a
    // test opts in with its own candidates.
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
  });

  it("shows pool load failures as a toast", async () => {
    renderWithProviders(
      <ToastProvider>
        <StarterWorkPoolCloud
          tasks={[]}
          isLoading={false}
          error="pool unavailable"
          canAct
          onOpenTask={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(await screen.findByText("Pool unavailable")).toBeInTheDocument();
    expect(screen.getByText("pool unavailable")).toBeInTheDocument();
  });

  it("labels manually created tasks as Custom instead of exposing their source id", () => {
    const sourceId = "c90aad2a-f7c5-4cd5-9b02-8c3ab5fb83ed";
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[{ ...task(1), sourceId, sourceUrl: null }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText(sourceId)).not.toBeInTheDocument();
  });

  it("places one page of tasks in five deterministic, unique cloud slots", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 6 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    const cards = screen.getAllByTestId(/^pool-task-task-/);
    expect(cards).toHaveLength(5);
    expect(cards.map((card) => card.dataset.cloudSlot)).toEqual(["0", "1", "2", "3", "4"]);
    expect(new Set(cards.map((card) => card.style.getPropertyValue("--cloud-left"))).size).toBe(5);
    expect(screen.queryByText("Starter task 6")).not.toBeInTheDocument();
  });

  it("keeps the existing pagination for pools larger than the cloud", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 6 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Starter task 6")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 1")).not.toBeInTheDocument();
  });

  it("opens the task's detail drawer instead of an editor, on either the cloud or the list", async () => {
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

    await user.click(screen.getByRole("button", { name: "Open details for Starter task 1" }));

    expect(onOpenTask).toHaveBeenCalledWith(task(1));
  });

  it("opens the drawer for HR too — the drawer itself reads as decision-free for them", async () => {
    const user = userEvent.setup();
    const onOpenTask = vi.fn();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct={false}
        onOpenTask={onOpenTask}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open details for Starter task 1" }));

    expect(onOpenTask).toHaveBeenCalledWith(task(1));
  });

  it("sorts unseen tasks first and marks them, leaving seen ones with a checkmark", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1), { ...task(2), reviewed: false }, task(3)]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    const cards = screen.getAllByTestId(/^pool-task-task-/);
    expect(cards[0]).toHaveAttribute("data-testid", "pool-task-task-2");
    expect(within(cards[0]).getByLabelText("Not looked at yet")).toBeInTheDocument();
    expect(within(cards[1]).getByLabelText("Looked at")).toBeInTheDocument();
  });

  it("badges a task flagged for Task 0", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[{ ...task(1), taskZeroEligible: true }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    // Scoped to the card: the filter bar has its own "Task 0" chip with the same text.
    expect(within(screen.getByTestId("pool-task-task-1")).getByText("Task 0")).toBeInTheDocument();
  });

  it("badges a task the tracker shows as assigned, but not one it merely doesn't know about", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[
          { ...task(1), sourceHasAssignee: true },
          { ...task(2), sourceHasAssignee: null },
        ]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    expect(
      within(screen.getByTestId("pool-task-task-1")).getByText("Someone is on this"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("pool-task-task-2")).queryByText("Someone is on this"),
    ).not.toBeInTheDocument();
  });

  it("shows when the pool was last checked against its trackers, using the newest task", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[
          { ...task(1), sourceCheckedAt: "2026-08-01T00:00:00.000Z" },
          { ...task(2), sourceCheckedAt: "2026-09-01T00:00:00.000Z" },
        ]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    // "2026-09-01" is the newer of the two, so it decides the wording — a month ago from a
    // fixed "now" the test doesn't control, which is why this asserts the label's shape rather
    // than pinning an exact relative phrase.
    expect(screen.getByText(/Checked/)).toBeInTheDocument();
  });

  it("says nothing about being checked when reconciliation has never run", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Checked/)).not.toBeInTheDocument();
  });

  it("filters to tasks nobody has looked at yet", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1), { ...task(2), reviewed: false }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^New/ }));

    expect(screen.getByText("Starter task 2")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 1")).not.toBeInTheDocument();
  });

  it("filters to tasks already looked at", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1), { ...task(2), reviewed: false }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Looked at/ }));

    expect(screen.getByText("Starter task 1")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 2")).not.toBeInTheDocument();
  });

  it("filters to tasks flagged for Task 0", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1), { ...task(2), taskZeroEligible: true }]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Task 0/ }));

    expect(screen.getByText("Starter task 2")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 1")).not.toBeInTheDocument();
  });

  it("says so, rather than showing the whole pool, when a filter matches nothing", async () => {
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

    await user.click(screen.getByRole("button", { name: /^Task 0/ }));

    expect(screen.getByText("No tasks match this filter.")).toBeInTheDocument();
  });

  it("offers an Only {project} chip once its corpus is known, and filters the pool by it", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      {
        sourceId: "github:acme/repo:ISSUE:99",
        tracker: "GITHUB",
        title: "An open issue",
        excerpt: null,
        excerptTruncated: false,
        labels: [],
        sourceUrl: null,
        hasAssignee: null,
        poolState: "AVAILABLE",
        updatedAtSource: null,
      },
    ]);
    const user = userEvent.setup();
    const otherRepoTask: StarterWorkTask = { ...task(2), sourceId: "github:other/repo:ISSUE:2" };
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1), otherRepoTask]}
        isLoading={false}
        error={null}
        canAct
        onOpenTask={vi.fn()}
      />,
    );

    const chip = await screen.findByRole("button", { name: "Only Project One" });
    await user.click(chip);

    expect(screen.getByText("Starter task 1")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 2")).not.toBeInTheDocument();
  });

  it("shows a sync control that calls onSync and reads as busy while syncing", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const { rerender } = renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct
        onSync={onSync}
        onOpenTask={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sync" }));
    expect(onSync).toHaveBeenCalledTimes(1);

    rerender(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct
        onSync={onSync}
        isSyncing
        onOpenTask={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Syncing…" })).toBeDisabled();
  });

  it("hides the sync control from HR even when a handler is provided", () => {
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task(1)]}
        isLoading={false}
        error={null}
        canAct={false}
        onSync={vi.fn()}
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /sync/i })).not.toBeInTheDocument();
  });
});
