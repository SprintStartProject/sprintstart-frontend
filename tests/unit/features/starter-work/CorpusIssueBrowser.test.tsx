import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CorpusIssueBrowser } from "../../../../src/features/starter-work/components/CorpusIssueBrowser";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import type { StarterWorkCandidate } from "../../../../src/features/starter-work/types";

function candidate(overrides: Partial<StarterWorkCandidate> = {}): StarterWorkCandidate {
  return {
    sourceId: "github:acme/repo:ISSUE:1",
    tracker: "GITHUB",
    title: "Fix the login redirect",
    excerpt: "Users land on the wrong page after signing in.",
    excerptTruncated: false,
    labels: ["bug"],
    sourceUrl: "https://github.com/acme/repo/issues/1",
    hasAssignee: null,
    poolState: "AVAILABLE",
    updatedAtSource: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("CorpusIssueBrowser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the project’s open issues with enough text to judge one", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.getByText(/users land on the wrong page after signing in/i)).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
  });

  /**
   * The copy must not read as picking which tasks hires are allowed to have — that is the gate
   * S3b deleted. The pool above is live either way, and this says so.
   */
  it("says mining keeps filling the pool, so this does not read as a gate", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(
      await screen.findByText(/a second way in, not a gate in front of it/i),
    ).toBeInTheDocument();
  });

  it("hides issues somebody is on by default, and counts them rather than swallowing them", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate(),
      candidate({
        sourceId: "jira:ONB-2",
        title: "Write the release notes",
        hasAssignee: true,
      }),
    ]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await screen.findByText("Fix the login redirect");
    expect(screen.queryByText("Write the release notes")).not.toBeInTheDocument();
    // The count is what stops the exclusion becoming an absence nobody can account for.
    expect(screen.getByTestId("show-assigned-issues").closest("label")).toHaveTextContent("(1)");

    await user.click(screen.getByTestId("show-assigned-issues"));

    expect(screen.getByText("Write the release notes")).toBeInTheDocument();
    expect(screen.getByText(/someone is on this/i)).toBeInTheDocument();
  });

  /**
   * `hasAssignee` is three-valued and null means *we do not know* — SprintStart does not ingest
   * GitHub assignees. Hiding unknowns would empty the list for every GitHub project, and marking
   * them would put a badge on nearly every row.
   */
  it("shows issues whose assignee is unknown, unmarked", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate({ hasAssignee: null }),
    ]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.queryByText(/someone is on this/i)).not.toBeInTheDocument();
  });

  it("shows an issue already in the pool as such, without offering it again", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate({ poolState: "IN_POOL" }),
    ]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByText(/already in the pool/i)).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:1")).not.toBeInTheDocument();
  });

  /**
   * Rejection is sticky, so a removed issue cannot go back. Leaving it out of the list would read
   * as a bug and send somebody hunting for an issue they know exists.
   */
  it("shows a removed issue as removed, and says it cannot go back", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate({ poolState: "REMOVED" }),
    ]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByText(/it cannot go back/i)).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:1")).not.toBeInTheDocument();
  });

  it("searches client-side over title, label and issue id", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate(),
      candidate({ sourceId: "jira:ONB-9", title: "Update the runbook", labels: ["docs"] }),
    ]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await screen.findByText("Fix the login redirect");
    await user.type(screen.getByTestId("corpus-issue-search"), "docs");

    expect(screen.getByText("Update the runbook")).toBeInTheDocument();
    expect(screen.queryByText("Fix the login redirect")).not.toBeInTheDocument();
    // Filtering is client-side over a list already in hand: one fetch, not one per keystroke.
    expect(starterWorkService.fetchCandidates).toHaveBeenCalledTimes(1);
  });

  it("promotes an issue and flips its row to pooled without refetching", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    const promote = vi.spyOn(starterWorkService, "promoteCandidate").mockResolvedValue({
      id: "task-1",
      sourceId: "github:acme/repo:ISSUE:1",
      title: "Fix the login redirect",
      summary: null,
      rationale: null,
      sourceUrl: "https://github.com/acme/repo/issues/1",
      competencyKeys: [],
      status: "LIVE",
      reviewed: true,
    });
    const onPromoted = vi.fn();
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={onPromoted} />);

    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:1"));

    await waitFor(() =>
      expect(promote).toHaveBeenCalledWith({ sourceId: "github:acme/repo:ISSUE:1" }),
    );
    expect(onPromoted).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
    expect(await screen.findByText(/already in the pool/i)).toBeInTheDocument();
    expect(starterWorkService.fetchCandidates).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refused promotion instead of pretending it landed", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    vi.spyOn(starterWorkService, "promoteCandidate").mockRejectedValue(
      new Error("Issue github:acme/repo:ISSUE:1 is already in the starter-work pool"),
    );
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:1"));

    expect(await screen.findByText(/already in the starter-work pool/i)).toBeInTheDocument();
  });

  it("lets HR read the list but not add to the pool", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    render(<CorpusIssueBrowser projectId="p1" canAct={false} onPromoted={vi.fn()} />);

    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:1")).not.toBeInTheDocument();
  });

  /**
   * An empty corpus must not read as "no good first work here" — that is the exact silence the
   * Jira-state bug hid behind. The three empty states mean different things and say so.
   */
  it("reads an empty corpus as nothing ingested, not as nothing worth doing", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByTestId("corpus-issue-empty")).toHaveTextContent(
      /no open issues have been ingested for this project yet/i,
    );
  });

  it("distinguishes a query that matched nothing from an empty corpus", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await screen.findByText("Fix the login redirect");
    await user.type(screen.getByTestId("corpus-issue-search"), "nothing matches this");

    expect(screen.getByTestId("corpus-issue-empty")).toHaveTextContent(/nothing matches/i);
  });

  it("says the whole list is filtered when every open issue is taken", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate({ hasAssignee: true }),
    ]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByTestId("corpus-issue-empty")).toHaveTextContent(
      /somebody is already on\. tick the box above/i,
    );
  });

  it("asks for a project rather than loading nothing silently", () => {
    const fetchCandidates = vi.spyOn(starterWorkService, "fetchCandidates");
    render(<CorpusIssueBrowser projectId="" canAct onPromoted={vi.fn()} />);

    expect(screen.getByText(/pick a project first/i)).toBeInTheDocument();
    expect(fetchCandidates).not.toHaveBeenCalled();
  });

  it("surfaces a failed load", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockRejectedValue(new Error("boom"));
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
