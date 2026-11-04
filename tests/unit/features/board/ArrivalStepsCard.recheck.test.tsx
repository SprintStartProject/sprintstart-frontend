import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import { arrivalService } from "../../../../src/services/arrivalService";
import type { ArrivalStep, MyArrival } from "../../../../src/features/arrival/types";
import type { Board, ArrivalStepsContent } from "../../../../src/features/board/types";

const openAiBuddy = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/services/arrivalService", () => ({
  arrivalService: { confirmStep: vi.fn(), refreshMyArrival: vi.fn() },
}));

vi.mock("../../../../src/features/buddy/aiBuddyBus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/features/buddy/aiBuddyBus")>()),
  openAiBuddy,
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

const content = (steps: ArrivalStep[]): ArrivalStepsContent => ({
  kind: "ARRIVAL_STEPS",
  steps,
  observedCount: 0,
  declaredCount: 0,
  outstandingCount: steps.filter((entry) => !entry.settled).length,
});

function board(steps: ArrivalStep[]): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: [
      {
        id: "c0",
        kind: "ARRIVAL_STEPS",
        owner: "AI",
        position: 0,
        placedAt: null,
        content: content(steps),
      },
    ],
  };
}

const arrival = (steps: ArrivalStep[]) => ({ steps }) as unknown as MyArrival;

describe("ArrivalStepsCard re-check and summary", () => {
  beforeEach(() => {
    openAiBuddy.mockReset();
    vi.mocked(arrivalService.confirmStep).mockReset();
    vi.mocked(arrivalService.refreshMyArrival).mockReset().mockRejectedValue(new Error("quiet"));
  });

  it("says it is checking while the re-check runs, and stops saying so when it ends", async () => {
    let finish: (value: MyArrival) => void = () => undefined;
    vi.mocked(arrivalService.refreshMyArrival).mockReturnValue(
      new Promise<MyArrival>((resolve) => (finish = resolve)),
    );

    render(<BoardGrid board={board([step()])} />);

    expect(await screen.findByText(/Checking what we can see for ourselves/)).toBeInTheDocument();
    finish(arrival([step()]));
    await waitFor(() =>
      expect(screen.queryByText(/Checking what we can see for ourselves/)).not.toBeInTheDocument(),
    );
  });

  it("stops saying it is checking when the re-check fails, and keeps the list it was given", async () => {
    render(<BoardGrid board={board([step()])} />);

    await waitFor(() =>
      expect(screen.queryByText(/Checking what we can see for ourselves/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(screen.getByText(/1 still to do/)).toBeInTheDocument();
  });

  it("shows what the re-check saw instead of the list the board handed over", async () => {
    vi.mocked(arrivalService.refreshMyArrival).mockResolvedValue(
      arrival([step({ settled: true, rigor: "OBSERVED", settledAt: "x" })]),
    );

    render(<BoardGrid board={board([step()])} />);

    expect(await screen.findByText("Confirmed automatically")).toBeInTheDocument();
    expect(screen.getByText("Nothing outstanding")).toBeInTheDocument();
  });

  it("counts confirmed and self-declared steps apart in the subtitle", () => {
    render(
      <BoardGrid
        board={board([
          step({ key: "a", settled: true, rigor: "OBSERVED", settledAt: "x" }),
          step({ key: "b", settled: true, rigor: "DECLARED", settledAt: "x" }),
          step({ key: "c", settled: true, rigor: "DECLARED", settledAt: "x" }),
          step({ key: "d" }),
        ])}
      />,
    );

    expect(
      screen.getByText("1 still to do · 1 confirmed · 2 you told us about"),
    ).toBeInTheDocument();
  });

  it("shows the busy state on the step being confirmed and clears an earlier failure", async () => {
    vi.mocked(arrivalService.confirmStep).mockRejectedValueOnce(new Error("nope"));
    render(<BoardGrid board={board([step()])} />);

    fireEvent.click(screen.getByRole("button", { name: /done this/i }));
    expect(await screen.findByText(/didn't save/i)).toBeInTheDocument();

    let settle: (value: ArrivalStep) => void = () => undefined;
    vi.mocked(arrivalService.confirmStep).mockReturnValue(
      new Promise<ArrivalStep>((resolve) => (settle = resolve)),
    );
    fireEvent.click(screen.getByRole("button", { name: /done this/i }));

    await waitFor(() => expect(screen.queryByText(/didn't save/i)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /done this/i })).toBeDisabled();
    settle(step({ settled: true, rigor: "DECLARED", settledAt: "x" }));
    expect(await screen.findByText("You marked this done")).toBeInTheDocument();
  });

  it("offers a stuck question while something is outstanding", () => {
    render(<BoardGrid board={board([step()])} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask your buddy about this" }));

    expect(openAiBuddy).toHaveBeenCalledWith({
      draft: "I'm stuck on one of my setup steps — who do I ask?",
    });
  });

  it("offers a what-next question once everything is settled", () => {
    render(
      <BoardGrid board={board([step({ settled: true, rigor: "DECLARED", settledAt: "x" })])} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ask your buddy about this" }));

    expect(openAiBuddy).toHaveBeenCalledWith({
      draft: "I'm set up now. What should I look at first?",
    });
  });
});
