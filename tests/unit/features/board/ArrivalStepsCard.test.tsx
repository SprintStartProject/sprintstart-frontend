import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import { arrivalService } from "../../../../src/services/arrivalService";
import type { ArrivalStep, MyArrival } from "../../../../src/features/arrival/types";
import type { Board, BoardCard, ArrivalStepsContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/services/arrivalService", () => ({
  arrivalService: { confirmStep: vi.fn(), refreshMyArrival: vi.fn() },
}));

const step = (over: Partial<ArrivalStep> = {}): ArrivalStep => ({
  key: "vpn",
  projectId: null,
  projectName: null,
  title: "Request VPN access",
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
  ...over,
});

const arrivalContent = (over: Partial<ArrivalStepsContent> = {}): ArrivalStepsContent => ({
  kind: "ARRIVAL_STEPS",
  steps: [step()],
  observedCount: 0,
  declaredCount: 0,
  outstandingCount: 1,
  ...over,
});

function board(cards: BoardCard["content"][]): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: cards.map((content, index) => ({
      id: `c${index}`,
      kind: content.kind,
      owner: "AI",
      position: index,
      placedAt: null,
      content,
    })),
  };
}

describe("ArrivalStepsCard", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.confirmStep).mockReset();
    // Rejected by default: the card must be right about everything below without a check ever
    // succeeding, because that is the ordinary case for a step nothing can observe.
    vi.mocked(arrivalService.refreshMyArrival).mockReset().mockRejectedValue(new Error("quiet"));
  });

  it("lists what is still outstanding", () => {
    render(<BoardGrid board={board([arrivalContent()])} />);

    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(screen.getByText(/1 still to do/)).toBeInTheDocument();
  });

  /**
   * The defect that killed the previous onboarding model: a single figure that counted a ticked
   * box exactly like something the system had verified. Counts are named by how they were
   * established precisely so they cannot collapse into one score.
   */
  it("never renders a blended completion figure", () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [
              step({ key: "a", settled: true, rigor: "DECLARED", settledAt: "x" }),
              step({ key: "b", title: "Get a laptop" }),
            ],
            declaredCount: 1,
            outstandingCount: 1,
          }),
        ])}
      />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // "1 of 2" is the same conflation spelled differently.
    expect(screen.queryByText(/\d+\s*(of|\/)\s*\d+/)).not.toBeInTheDocument();
  });

  it("attributes a self-confirmed step to the hire rather than to the system", () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [step({ settled: true, rigor: "DECLARED", settledAt: "x" })],
            declaredCount: 1,
            outstandingCount: 0,
          }),
        ])}
      />,
    );

    expect(screen.getByText("You marked this done")).toBeInTheDocument();
    expect(screen.queryByText("Confirmed automatically")).not.toBeInTheDocument();
  });

  it("confirming a step settles it in place", async () => {
    vi.mocked(arrivalService.confirmStep).mockResolvedValue(
      step({ settled: true, rigor: "DECLARED", settledAt: "2026-08-02T10:00:00Z" }),
    );

    render(<BoardGrid board={board([arrivalContent()])} />);
    fireEvent.click(screen.getByRole("button", { name: /done this/i }));

    await waitFor(() => {
      expect(screen.getByText("You marked this done")).toBeInTheDocument();
    });
    expect(arrivalService.confirmStep).toHaveBeenCalledWith("vpn");
  });

  it("says so when confirming fails rather than showing it as done", async () => {
    vi.mocked(arrivalService.confirmStep).mockRejectedValue(new Error("nope"));

    render(<BoardGrid board={board([arrivalContent()])} />);
    fireEvent.click(screen.getByRole("button", { name: /done this/i }));

    await waitFor(() => {
      expect(screen.getByText(/didn't save/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("You marked this done")).not.toBeInTheDocument();
  });

  /**
   * A hire on two projects can be given "Request staging access" twice. Without a heading naming
   * whose step each is, the list is unreadable — which is why the wire carries the project name.
   */
  it("heads each project’s steps with the project name", () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [
              step({ key: "vpn", title: "Request VPN access" }),
              step({ key: "staging", title: "Get staging access", projectName: "Apollo" }),
            ],
            outstandingCount: 2,
          }),
        ])}
      />,
    );

    // Company-wide answers "who else has this", rather than naming the scope's implementation.
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("Apollo")).toBeInTheDocument();
  });

  /** A lone "Everyone" over a list that is entirely company-wide is a label saying nothing. */
  it("shows no headings when every step is company-wide", () => {
    render(<BoardGrid board={board([arrivalContent()])} />);

    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(screen.queryByText("Everyone")).not.toBeInTheDocument();
  });

  it("links a step whose author gave it an ordinary address", () => {
    render(
      <BoardGrid
        board={board([arrivalContent({ steps: [step({ href: "https://vpn.example/request" })] })])}
      />,
    );

    expect(screen.getByLabelText('Open the page for "Request VPN access"')).toHaveAttribute(
      "href",
      "https://vpn.example/request",
    );
  });

  /**
   * The link is free text an author typed and it renders on somebody else's board, so a
   * scheme that executes on click must not become an anchor. The step still shows; only the
   * link is withheld.
   */
  it("renders no link for a step whose address would run code", () => {
    render(
      <BoardGrid
        board={board([arrivalContent({ steps: [step({ href: "javascript:alert(1)" })] })])}
      />,
    );

    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Open the page for "Request VPN access"'),
    ).not.toBeInTheDocument();
  });

  /**
   * A step the hire may not settle is not one they get a button for — the backend refuses the
   * confirmation, and offering it would be an affordance whose only outcome is an error.
   */
  it("offers no confirm button for a step only the system may settle", () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [step({ settledBy: "OBSERVED", selfConfirmable: false })],
          }),
        ])}
      />,
    );

    expect(screen.queryByRole("button", { name: /done this/i })).not.toBeInTheDocument();
  });

  /**
   * `selfConfirmable` is not a synonym for `settledBy === 'DECLARED'`, and reading it as one
   * would take the button off "my machine builds" — a step that is observable but never
   * refutable, whose evidence arrives days after it mattered. The hire's word is the answer that
   * lands on day one there, and the derivation is only a backstop.
   */
  it("still offers the button on a derived step the hire may also claim", () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [step({ settledBy: "OBSERVED", selfConfirmable: true })],
          }),
        ])}
      />,
    );

    expect(screen.getByRole("button", { name: /done this/i })).toBeInTheDocument();
  });

  it("settles a step the check can see, without the hire touching it", async () => {
    vi.mocked(arrivalService.refreshMyArrival).mockResolvedValue({
      steps: [step({ settled: true, rigor: "OBSERVED", settledAt: "2026-08-02T10:00:00Z" })],
      observedCount: 1,
      declaredCount: 0,
      outstandingCount: 0,
    });

    render(<BoardGrid board={board([arrivalContent()])} />);

    expect(await screen.findByText("Confirmed automatically")).toBeInTheDocument();
    expect(screen.getByText(/Nothing outstanding/)).toBeInTheDocument();
  });

  /**
   * Observation settles a step; failing to observe never unsettles one. A rate limit, an outage
   * and a hire with no work yet are one answer here, and it is not "you have not done this".
   */
  it("leaves the list exactly as it was when the check cannot run", async () => {
    render(
      <BoardGrid
        board={board([
          arrivalContent({
            steps: [step({ settled: true, rigor: "DECLARED", settledAt: "x" })],
            declaredCount: 1,
            outstandingCount: 0,
          }),
        ])}
      />,
    );

    await waitFor(() => {
      expect(arrivalService.refreshMyArrival).toHaveBeenCalled();
    });
    expect(screen.getByText("You marked this done")).toBeInTheDocument();
    expect(screen.queryByText(/could not/i)).not.toBeInTheDocument();
  });

  /**
   * The hire may confirm while the check is still in flight, and their own word arriving first is
   * not something a later snapshot should undo — the same precedence the backend keeps.
   */
  it("does not undo a confirmation with an older snapshot from the check", async () => {
    let release: (value: MyArrival) => void = () => {};
    vi.mocked(arrivalService.refreshMyArrival).mockReturnValue(
      new Promise<MyArrival>((resolve) => {
        release = resolve;
      }),
    );
    vi.mocked(arrivalService.confirmStep).mockResolvedValue(
      step({ settled: true, rigor: "DECLARED", settledAt: "2026-08-02T10:00:00Z" }),
    );

    render(<BoardGrid board={board([arrivalContent()])} />);
    fireEvent.click(screen.getByRole("button", { name: /done this/i }));
    await waitFor(() => {
      expect(screen.getByText("You marked this done")).toBeInTheDocument();
    });

    release({
      steps: [step()],
      observedCount: 0,
      declaredCount: 0,
      outstandingCount: 1,
    });

    await waitFor(() => {
      expect(screen.getByText("You marked this done")).toBeInTheDocument();
    });
  });
});
