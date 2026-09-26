import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TaskPoolBrowser } from "../../../../src/features/task-pool/components/TaskPoolBrowser";
import type { RankedStarterWorkTask } from "../../../../src/features/starter-work/types";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({
  openAiBuddy: vi.fn(),
}));

vi.mock("../../../../src/services/myStarterWorkService", () => ({
  myStarterWorkService: {
    fetchMatches: vi.fn(),
    claim: vi.fn(),
  },
}));

import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";
import { myStarterWorkService } from "../../../../src/services/myStarterWorkService";

function match(
  id: string,
  title: string,
  over: Partial<RankedStarterWorkTask> = {},
  task: Partial<RankedStarterWorkTask["task"]> = {},
): RankedStarterWorkTask {
  return {
    task: {
      id,
      sourceId: `gh-${id}`,
      title,
      summary: null,
      rationale: null,
      sourceUrl: null,
      competencyKeys: [],
      status: "LIVE",
      reviewed: true,
      taskZeroEligible: false,
      sourceHasAssignee: null,
      sourceCheckedAt: null,
      ...task,
    },
    score: 1,
    matchedCompetencyKeys: [],
    taskType: "BUG",
    reasons: ["You know TypeScript"],
    ...over,
  };
}

describe("the task browser", () => {
  beforeEach(() => {
    vi.mocked(openAiBuddy).mockReset();
    vi.mocked(myStarterWorkService.claim).mockReset();
    vi.mocked(myStarterWorkService.fetchMatches).mockResolvedValue([
      match("t1", "Fix the flaky login test"),
      match("t2", "Document the release flow", { taskType: "DOCS" }),
      match("t3", "Add a retry to the uploader", {}, { sourceHasAssignee: true }),
    ]);
  });

  it("lists the whole pool in the order it was ranked", async () => {
    render(<TaskPoolBrowser isOpen onClose={() => {}} />);

    const titles = await screen.findAllByText(/fix the flaky|document the release|add a retry/i);
    expect(titles.map((el) => el.textContent)).toEqual([
      "Fix the flaky login test",
      "Document the release flow",
      "Add a retry to the uploader",
    ]);
  });

  it("filters by search, type and whether somebody is already on it", async () => {
    render(<TaskPoolBrowser isOpen onClose={() => {}} />);
    await screen.findByText("Fix the flaky login test");

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

  it("grabs only after the second press, then closes", async () => {
    vi.mocked(myStarterWorkService.claim).mockResolvedValue({
      proposalId: "t1",
      title: "Fix the flaky login test",
      summary: null,
      sourceUrl: null,
    });
    const onClose = vi.fn();
    render(<TaskPoolBrowser isOpen onClose={onClose} />);
    await screen.findByText("Fix the flaky login test");

    fireEvent.click(screen.getAllByRole("button", { name: /grab this/i })[0]);
    expect(myStarterWorkService.claim).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, grab it/i }));
    await waitFor(() => expect(myStarterWorkService.claim).toHaveBeenCalledWith("p1", "t1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("hands the choice to the buddy when the hire asks for help", async () => {
    const onClose = vi.fn();
    render(<TaskPoolBrowser isOpen onClose={onClose} />);
    await screen.findByText("Fix the flaky login test");

    fireEvent.click(screen.getByRole("button", { name: /help me choose/i }));
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(openAiBuddy).mock.calls[0][0]?.draft).toMatch(/not sure which one fits/i);

    fireEvent.click(screen.getAllByRole("button", { name: /is this a good fit/i })[1]);
    expect(vi.mocked(openAiBuddy).mock.calls[1][0]?.draft).toContain("Document the release flow");
  });
});
