import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
import { orientationService } from "../../../../src/services/orientationService";
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
    competencyKeys: ["react", "testing", "docs", "typescript"],
    status: "LIVE",
    reviewed: true,
  };
}

describe("StarterWorkPoolCloud", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows pool load failures as a toast", async () => {
    renderWithProviders(
      <ToastProvider>
        <StarterWorkPoolCloud tasks={[]} isLoading={false} error="pool unavailable" canAct />
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
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Starter task 6")).toBeInTheDocument();
    expect(screen.queryByText("Starter task 1")).not.toBeInTheDocument();
  });

  it("opens the existing orientation editor for the selected pool task", async () => {
    const user = userEvent.setup();
    const fetchOrientation = vi
      .spyOn(orientationService, "fetchTaskOrientation")
      .mockResolvedValue({
        taskId: "task-1",
        taskTitle: "Starter task 1",
        taskUrl: null,
        packet: null,
        reason: null,
      });

    renderWithProviders(
      <StarterWorkPoolCloud tasks={[task(1)]} isLoading={false} error={null} canAct />,
    );

    await user.click(screen.getByRole("button", { name: "Edit orientation for Starter task 1" }));

    await waitFor(() => expect(fetchOrientation).toHaveBeenCalledWith("task-1", "p1"));
    expect(await screen.findByTestId("orientation-editor")).toBeInTheDocument();
  });
});
