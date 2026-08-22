import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskOrientationManager } from "../../../../src/features/orientation/components/TaskOrientationManager";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import { orientationService } from "../../../../src/services/orientationService";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

// The project is chosen globally in the sidebar switcher, so the component reads the
// context rather than loading a listing of its own.
vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Proj" })],
      }),
  };
});

const approvedTask: StarterWorkTask = {
  id: "task-1",
  sourceId: "github:acme/repo:ISSUE:42",
  title: "Fix the login redirect",
  summary: null,
  rationale: null,
  sourceUrl: "https://github.com/acme/repo/issues/42",
  competencyKeys: [],
  status: "LIVE",
  reviewed: true,
};

describe("TaskOrientationManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([approvedTask]);
  });

  it("lists approved tasks and opens the editor scoped to task and project", async () => {
    const user = userEvent.setup();
    const fetchOrientation = vi
      .spyOn(orientationService, "fetchTaskOrientation")
      .mockResolvedValue({
        taskId: "task-1",
        taskTitle: "Fix the login redirect",
        taskUrl: null,
        packet: null,
        reason: null,
      });

    render(<TaskOrientationManager />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();

    await user.click(screen.getByTestId("edit-orientation-task-1"));

    await waitFor(() => expect(fetchOrientation).toHaveBeenCalledWith("task-1", "p1"));
    expect(await screen.findByTestId("orientation-editor")).toBeInTheDocument();
  });

  it("shows an empty state when there are no approved tasks", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);

    render(<TaskOrientationManager />);

    expect(await screen.findByText(/No approved tasks yet/)).toBeInTheDocument();
  });
});
