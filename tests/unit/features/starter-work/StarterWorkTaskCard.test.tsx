import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StarterWorkTaskCard } from "../../../../src/features/starter-work/components/StarterWorkTaskCard";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

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
  it("keeps labels and review actions in one fixed row", () => {
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
    expect(metaRow).toContainElement(screen.getByText("auth"));
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
});
