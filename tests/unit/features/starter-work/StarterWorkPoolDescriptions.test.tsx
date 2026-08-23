import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkPoolCloud } from "../../../../src/features/starter-work/components/StarterWorkPoolCloud";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
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

function task(id: string, summary: string | null): StarterWorkTask {
  return {
    id,
    sourceId: `github:acme/repo:ISSUE:${id}`,
    title: `Starter task ${id}`,
    summary,
    rationale: null,
    sourceUrl: `https://github.com/acme/repo/issues/${id}`,
    competencyKeys: [],
    status: "LIVE",
    reviewed: true,
  };
}

describe("StarterWorkPoolCloud descriptions", () => {
  beforeEach(() => {
    // The cloud view only renders from `sm` up, so pin a desktop viewport to assert on cloud cards.
    mockViewport();
  });

  it("renders a real description as one truncated line and omits blank descriptions", async () => {
    const user = userEvent.setup();
    const description = "A meaningful description that previews what the task is about.";

    renderWithProviders(
      <StarterWorkPoolCloud
        tasks={[task("1", description), task("2", "   ")]}
        isLoading={false}
        error={null}
        canAct={false}
      />,
    );

    const cloudDescription = screen.getByText(description);
    expect(cloudDescription).toHaveClass("truncate");
    expect(cloudDescription).toHaveAttribute("title", description);
    expect(screen.getByTestId("pool-task-2").querySelector("p")).toBeNull();

    await user.click(screen.getByRole("button", { name: "List view" }));

    const listDescription = screen.getByText(description);
    expect(listDescription).toHaveClass("truncate");
    expect(listDescription).toHaveAttribute("title", description);
    expect(screen.getByTestId("pool-list-task-2").querySelector("p")).toBeNull();
  });
});
