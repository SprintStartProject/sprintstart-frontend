import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StarterWorkTaskCard } from "../../../../src/features/starter-work/components/StarterWorkTaskCard";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";
import { mockViewport } from "../../setup/matchMedia";

const task: StarterWorkTask = {
  id: "task-1",
  sourceId: "github:acme/repo:ISSUE:42",
  title: "A review title that needs the full available width until actions appear",
  summary: "A longer description that stays stable while the review actions are revealed.",
  rationale: null,
  sourceUrl: "https://github.com/acme/repo/issues/42",
  competencyKeys: ["auth"],
  status: "LIVE",
  reviewed: false,
};

describe("StarterWorkTaskCard", () => {
  beforeEach(() => {
    // The quick actions reveal on hover from `sm` up; pin a desktop viewport so the reveal tests
    // exercise that path rather than the touch fallback (which shows them from the start).
    mockViewport();
  });

  it("keeps the source line and review actions stable while the actions reveal", () => {
    const { container } = render(
      <StarterWorkTaskCard
        task={task}
        canAct
        isOpen={false}
        onSelect={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const card = container.querySelector("[data-task-card]");
    const title = screen.getByText(task.title);
    const summary = screen.getByText(task.summary!);
    const metaRow = screen.getByTestId("review-meta-row-task-1");
    const actions = screen.getByTestId("task-actions-task-1");

    expect(card).not.toBeNull();
    expect(card).not.toHaveClass("h-36");
    expect(title).toHaveClass("line-clamp-2");
    expect(summary).toHaveClass("truncate");
    // Labels sit in their own row below the source line, so nothing clips when there are many.
    const labelsRow = screen.getByTestId("review-labels-row-task-1");
    expect(labelsRow).toContainElement(screen.getByText("auth"));
    expect(metaRow).not.toContainElement(screen.getByText("auth"));
    expect(metaRow).toContainElement(actions);
    expect(actions).toHaveClass("pointer-events-none");

    fireEvent.pointerEnter(card!);

    expect(title).toHaveClass("line-clamp-2");
    expect(summary).toHaveClass("truncate");
    expect(actions).toHaveClass("pointer-events-auto");
    expect(actions).not.toHaveClass("pointer-events-none");
    expect(screen.getByTestId("approve-task-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("reject-task-task-1")).toBeInTheDocument();

    fireEvent.pointerLeave(card!);

    expect(title).toHaveClass("line-clamp-2");
    expect(summary).toHaveClass("truncate");
    expect(actions).toHaveClass("pointer-events-none");
  });

  it("keeps the meta row populated with source metadata when the task has no competencies", () => {
    render(
      <StarterWorkTaskCard
        task={{ ...task, competencyKeys: [] }}
        canAct
        isOpen={false}
        onSelect={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const metaRow = screen.getByTestId("review-meta-row-task-1");
    expect(metaRow).toContainElement(screen.getByText("GitHub"));
    expect(metaRow).toContainElement(screen.getByText("#42"));
    expect(metaRow).toContainElement(screen.getByText("repo"));
    // No competencies, so the labels row is left out rather than sitting empty.
    expect(screen.queryByTestId("review-labels-row-task-1")).not.toBeInTheDocument();
  });

  it("shows the review actions from the start on mobile, where there is no hover", () => {
    mockViewport(false);

    render(
      <StarterWorkTaskCard
        task={task}
        canAct
        isOpen={false}
        onSelect={vi.fn()}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onReject={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const actions = screen.getByTestId("task-actions-task-1");
    // No pointer interaction: the cluster is already interactive and both decisions are reachable.
    expect(actions).toHaveClass("pointer-events-auto");
    expect(actions).not.toHaveClass("pointer-events-none");
    expect(screen.getByTestId("approve-task-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("reject-task-task-1")).toBeInTheDocument();
  });
});
