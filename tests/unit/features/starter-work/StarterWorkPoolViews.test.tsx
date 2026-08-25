import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
import { orientationService } from "../../../../src/services/orientationService";
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
  };
}

describe("StarterWorkPoolCloud views", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    // The pool offers its cloud view from `sm` up, so pin a desktop viewport for these view tests.
    mockViewport();
  });

  it("chooses a different one of the five cloud layouts whenever the page changes", async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, "random").mockReturnValue(0);
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 7 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
      />,
    );

    expect(screen.getByTestId("pool-task-cloud")).toHaveAttribute("data-cloud-layout", "0");

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByTestId("pool-task-cloud")).toHaveAttribute("data-cloud-layout", "1");
  });

  it("switches to issue-style list rows and shows only the repository name", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud tasks={[task(1)]} isLoading={false} error={null} canAct />,
    );

    expect(screen.getByText("repo")).toBeInTheDocument();
    expect(screen.queryByText("acme/repo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.getByTestId("pool-task-list")).toBeInTheDocument();
    expect(screen.queryByTestId("pool-task-cloud")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses the full list-row surface as the orientation drawer trigger", async () => {
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

    await user.click(screen.getByRole("button", { name: "List view" }));
    const rowTrigger = screen.getByRole("button", {
      name: "Edit orientation for Starter task 1",
    });
    expect(rowTrigger).toHaveClass("absolute", "inset-0");

    await user.click(rowTrigger);

    await waitFor(() => expect(fetchOrientation).toHaveBeenCalledWith("task-1", "p1"));
    expect(await screen.findByTestId("orientation-editor")).toBeInTheDocument();
  });
});
