import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TaskPoolCard } from "../../../../src/features/board/components/TaskPoolCard";
import type {
  BoardCard,
  BoardPoolTask,
  TaskPoolContent,
} from "../../../../src/features/board/types";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({
  openAiBuddy: vi.fn(),
}));

vi.mock("../../../../src/services/myStarterWorkService", () => ({
  myStarterWorkService: { claim: vi.fn() },
}));

import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";
import { myStarterWorkService } from "../../../../src/services/myStarterWorkService";

const card: Pick<BoardCard, "id" | "owner" | "placedAt"> = {
  id: "c1",
  owner: "AI",
  placedAt: null,
};

function task(taskId: string, title: string, over: Partial<BoardPoolTask> = {}): BoardPoolTask {
  return {
    taskId,
    title,
    summary: null,
    rationale: null,
    url: null,
    taskType: "BUG",
    reasons: ["You know TypeScript"],
    bestFit: false,
    sourceHasAssignee: null,
    ...over,
  };
}

function content(over: Partial<TaskPoolContent> = {}): TaskPoolContent {
  return {
    kind: "TASK_POOL",
    tasks: [
      task("t1", "Fix the flaky login test", { bestFit: true }),
      task("t2", "Document the release flow", { taskType: "DOCS" }),
      task("t3", "Add a retry to the uploader", { sourceHasAssignee: true }),
    ],
    currentTaskId: null,
    ...over,
  };
}

/** The draft the last "ask the buddy" control put in the composer. */
function lastDraft(): string {
  const calls = vi.mocked(openAiBuddy).mock.calls;
  return calls[calls.length - 1][0]?.draft ?? "";
}

describe("the task pool card", () => {
  beforeEach(() => {
    vi.mocked(openAiBuddy).mockReset();
    vi.mocked(myStarterWorkService.claim).mockReset();
  });

  it("lists the whole pool in the order it was ranked", () => {
    render(<TaskPoolCard content={content()} card={card} />);

    const titles = screen.getAllByText(/fix the flaky|document the release|add a retry/i);
    expect(titles.map((el) => el.textContent)).toEqual([
      "Fix the flaky login test",
      "Document the release flow",
      "Add a retry to the uploader",
    ]);
    expect(screen.getByText("Best fit")).toBeInTheDocument();
  });

  it("filters by search, type and whether somebody is already on it", () => {
    render(<TaskPoolCard content={content()} card={card} />);

    fireEvent.click(screen.getByRole("button", { name: "Docs" }));
    expect(screen.queryByText("Fix the flaky login test")).not.toBeInTheDocument();
    expect(screen.getByText("Document the release flow")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide taken" }));
    expect(screen.queryByText("Add a retry to the uploader")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /search tasks/i }), {
      target: { value: "login" },
    });
    expect(screen.getByText("Fix the flaky login test")).toBeInTheDocument();
    expect(screen.queryByText("Document the release flow")).not.toBeInTheDocument();
  });

  it("grabs only after the second press", async () => {
    vi.mocked(myStarterWorkService.claim).mockResolvedValue({
      proposalId: "t1",
      title: "Fix the flaky login test",
      summary: null,
      sourceUrl: null,
    });
    render(<TaskPoolCard content={content()} card={card} />);

    fireEvent.click(screen.getAllByRole("button", { name: /grab this/i })[0]);
    expect(myStarterWorkService.claim).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, grab it/i }));
    await waitFor(() => expect(myStarterWorkService.claim).toHaveBeenCalledWith("p1", "t1"));
  });

  it("marks the task the hire is on instead of offering to grab it", () => {
    render(<TaskPoolCard content={content({ currentTaskId: "t2" })} card={card} />);

    expect(screen.getByText(/you're on this one/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /grab this/i })).toHaveLength(2);
  });

  it("hands the choice to the buddy when the hire asks for help", () => {
    render(<TaskPoolCard content={content()} card={card} />);

    fireEvent.click(screen.getByRole("button", { name: /help me choose/i }));
    expect(lastDraft()).toMatch(/not sure which one fits/i);

    fireEvent.click(screen.getAllByRole("button", { name: /is this a good fit/i })[1]);
    expect(lastDraft()).toContain("Document the release flow");
  });

  it("says so when the pool is empty, and still offers the buddy", () => {
    render(<TaskPoolCard content={content({ tasks: [] })} card={card} />);

    expect(screen.getByText(/hasn't put any starter tasks up/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /help me choose/i })).toBeInTheDocument();
  });
});
