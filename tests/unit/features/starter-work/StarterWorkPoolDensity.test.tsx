import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
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
  };
}

describe("StarterWorkPoolCloud density", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows at most three issue-style rows on each list page", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={Array.from({ length: 4 }, (_, index) => task(index + 1))}
        isLoading={false}
        error={null}
        canAct
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.getAllByTestId(/^pool-list-task-/)).toHaveLength(3);
    expect(screen.queryByText("Starter task 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Starter task 4")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^pool-list-task-/)).toHaveLength(1);
  });

  it("does not render competency badges in either pool view", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StarterWorkPoolCloud tasks={[task(1)]} isLoading={false} error={null} canAct />,
    );

    expect(screen.queryByText("react")).not.toBeInTheDocument();
    expect(screen.queryByText("testing")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.queryByText("react")).not.toBeInTheDocument();
    expect(screen.queryByText("testing")).not.toBeInTheDocument();
  });
});
