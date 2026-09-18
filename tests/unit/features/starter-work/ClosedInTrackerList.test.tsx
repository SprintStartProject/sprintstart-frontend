import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClosedInTrackerList } from "../../../../src/features/starter-work/components/ClosedInTrackerList";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import type { StarterWorkTask } from "../../../../src/features/starter-work/types";

function staleTask(over: Partial<StarterWorkTask> = {}): StarterWorkTask {
  return {
    id: "task-1",
    sourceId: "github:acme/repo:ISSUE:1",
    title: "Fix the login redirect",
    summary: null,
    rationale: null,
    sourceUrl: "https://github.com/acme/repo/issues/1",
    competencyKeys: [],
    status: "STALE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("ClosedInTrackerList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the pool for STALE, not the live status", async () => {
    const fetchPool = vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([staleTask()]);
    render(<ClosedInTrackerList onOpenTask={vi.fn()} />);

    await screen.findByText("Closed in the tracker");

    expect(fetchPool).toHaveBeenCalledWith("STALE");
  });

  it("renders nothing once loaded with an empty stale pool", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    const { container } = render(<ClosedInTrackerList onOpenTask={vi.fn()} />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("starts collapsed, and opens to show the closed tasks on a click", async () => {
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([staleTask()]);
    const user = userEvent.setup();
    render(<ClosedInTrackerList onOpenTask={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /closed in the tracker/i });
    expect(await within(toggle).findByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Fix the login redirect")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
  });

  it("opens the shared task drawer from a row", async () => {
    const task = staleTask();
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([task]);
    const onOpenTask = vi.fn();
    const user = userEvent.setup();
    render(<ClosedInTrackerList onOpenTask={onOpenTask} />);

    await user.click(await screen.findByRole("button", { name: /closed in the tracker/i }));
    await user.click(await screen.findByText("Fix the login redirect"));

    expect(onOpenTask).toHaveBeenCalledWith(task);
  });
});
