import { render as testingRender, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CorpusIssueBrowser } from "../../../../src/features/starter-work/components/CorpusIssueBrowser";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { starterWorkService } from "../../../../src/services/starterWorkService";
import type { StarterWorkCandidate } from "../../../../src/features/starter-work/types";

function render(ui: ReactElement) {
  return testingRender(<ToastProvider>{ui}</ToastProvider>);
}

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

/** Open a compact issue row to reveal its detail drawer. */
async function openRow(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`open ${title}`, "i") }));
}

/** Pick a pool-state filter option (the list defaults to "New"). */
async function selectPoolFilter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("combobox", { name: /filter issues by pool state/i }));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("CorpusIssueBrowser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the project’s open issues and shows the body when a row is opened", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    // The row is compact: title and label are on it, the body is not.
    expect(await screen.findByText("Fix the login redirect")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(
      screen.queryByText(/users land on the wrong page after signing in/i),
    ).not.toBeInTheDocument();

    await openRow(user, "Fix the login redirect");

    expect(
      await screen.findByText(/users land on the wrong page after signing in/i),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const overlay = screen
      .getAllByRole("button", { name: "Close details" })
      .find((button) => !dialog.contains(button));
    expect(overlay).toHaveClass("bg-app-overlay", "opacity-100");
  });

  /**
   * The raw source id is turned into readable pieces: the number as a badge, the repo as text.
   */
  it("renders the source id as a tracker badge, an issue number and a repo", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await screen.findByText("Fix the login redirect");
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("acme/repo")).toBeInTheDocument();
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
    expect(screen.getByText(/also show issues someone is already on \(1\)/i)).toBeInTheDocument();

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
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    // The list defaults to "New", so switch to see the pooled issue at all.
    await screen.findByTestId("corpus-issue-empty");
    await selectPoolFilter(user, "All issues");

    // It shows on the list, and opening it offers no way to add it again — the footer marks it
    // pooled instead ("Already in the pool" is unique to the drawer footer).
    await openRow(user, "Fix the login redirect");
    expect(await screen.findByText(/already in the pool/i)).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:1")).not.toBeInTheDocument();
  });

  /**
   * Rejection is sticky, so a removed issue cannot go back. Leaving it out of the list would read
   * as a bug and send somebody hunting for an issue they know exists.
   */
  it("shows a removed issue as taken out of the pool", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate({ poolState: "REMOVED" }),
    ]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    // The list defaults to "New"; removed issues live behind the filter.
    await screen.findByTestId("corpus-issue-empty");
    await selectPoolFilter(user, "All issues");

    await openRow(user, "Fix the login redirect");

    // Both the list row and the drawer's Pool status now carry a "Taken out" badge, so scope
    // the assertion to the drawer to prove it is the detail view that marks the removed state.
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/taken out/i)).toBeInTheDocument();
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

  it("promotes an issue from its drawer and flips it to pooled without refetching", async () => {
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

    await openRow(user, "Fix the login redirect");
    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:1"));

    await waitFor(() =>
      expect(promote).toHaveBeenCalledWith({ sourceId: "github:acme/repo:ISSUE:1" }),
    );
    expect(onPromoted).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }), {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });
    // The row badge and the drawer footer both say it now, so match either.
    expect((await screen.findAllByText(/already in the pool/i)).length).toBeGreaterThan(0);
    expect(starterWorkService.fetchCandidates).toHaveBeenCalledTimes(1);
  });

  it("adds an issue straight from its row, without opening the drawer", async () => {
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

    await user.click(await screen.findByTestId("quick-promote-issue-github:acme/repo:ISSUE:1"));

    await waitFor(() =>
      expect(promote).toHaveBeenCalledWith({ sourceId: "github:acme/repo:ISSUE:1" }),
    );
    expect(onPromoted).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }), {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });
    // The row flips to pooled, so it no longer offers the quick add.
    await waitFor(() =>
      expect(
        screen.queryByTestId("quick-promote-issue-github:acme/repo:ISSUE:1"),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not offer the quick add on the row to HR", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    render(<CorpusIssueBrowser projectId="p1" canAct={false} onPromoted={vi.fn()} />);

    await screen.findByText("Fix the login redirect");
    expect(
      screen.queryByTestId("quick-promote-issue-github:acme/repo:ISSUE:1"),
    ).not.toBeInTheDocument();
  });

  it("surfaces a refused promotion instead of pretending it landed", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    vi.spyOn(starterWorkService, "promoteCandidate").mockRejectedValue(
      new Error("Issue github:acme/repo:ISSUE:1 is already in the starter-work pool"),
    );
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await openRow(user, "Fix the login redirect");
    await user.click(await screen.findByTestId("promote-issue-github:acme/repo:ISSUE:1"));

    // The action failure is surfaced once through the shared toast viewport.
    expect(
      (await screen.findAllByText(/already in the starter-work pool/i)).length,
    ).toBeGreaterThan(0);
  });

  it("lets HR read the list and the body but not add to the pool", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([candidate()]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct={false} onPromoted={vi.fn()} />);

    await openRow(user, "Fix the login redirect");

    expect(await screen.findByText(/only a project manager can add work/i)).toBeInTheDocument();
    expect(screen.queryByTestId("promote-issue-github:acme/repo:ISSUE:1")).not.toBeInTheDocument();
  });

  it("filters the list by pool state", async () => {
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([
      candidate(),
      candidate({
        sourceId: "github:acme/repo:ISSUE:2",
        title: "Add the pooled one",
        poolState: "IN_POOL",
      }),
    ]);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    // Defaults to "New": the available issue shows, the pooled one is filtered out.
    await screen.findByText("Fix the login redirect");
    expect(screen.queryByText("Add the pooled one")).not.toBeInTheDocument();

    await selectPoolFilter(user, "In the pool");

    expect(screen.getByText("Add the pooled one")).toBeInTheDocument();
    expect(screen.queryByText("Fix the login redirect")).not.toBeInTheDocument();
  });

  it("paginates a long list and reveals later rows on the next page", async () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      candidate({
        sourceId: `github:acme/repo:ISSUE:${index + 1}`,
        title: `Issue number ${index + 1}`,
      }),
    );
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue(many);
    const user = userEvent.setup();
    render(<CorpusIssueBrowser projectId="p1" canAct onPromoted={vi.fn()} />);

    await screen.findByText("Issue number 1");
    // The eighth row is the page cut-off, so the ninth is off the first page.
    expect(screen.getByText("Issue number 8")).toBeInTheDocument();
    expect(screen.queryByText("Issue number 9")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByText("Issue number 9")).toBeInTheDocument();
    expect(screen.queryByText("Issue number 1")).not.toBeInTheDocument();
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
