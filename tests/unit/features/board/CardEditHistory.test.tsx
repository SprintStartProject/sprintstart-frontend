import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CardEditHistory } from "../../../../src/features/board/components/CardEditHistory";
import type {
  BoardActor,
  BoardCardLastChange,
  BoardCardPrevious,
} from "../../../../src/features/board/types";

const snapshot = (over: Partial<BoardCardPrevious> = {}): BoardCardPrevious => ({
  content: { kind: "NOTE", text: "deploys are on Wednesdays" },
  replacedBy: "BUDDY",
  replacedAt: "2026-09-29T10:15:30.123Z",
  ...over,
});

function renderStrip(
  over: {
    previous?: Partial<BoardCardPrevious>;
    lastChange?: BoardCardLastChange | null;
    restoring?: boolean;
    notice?: "restored" | "stale" | null;
  } = {},
) {
  const onRestore = vi.fn();
  render(
    <CardEditHistory
      cardId="c1"
      previous={snapshot(over.previous)}
      lastChange={over.lastChange}
      controlLabel="note"
      onRestore={onRestore}
      restoring={over.restoring ?? false}
      notice={over.notice ?? null}
    />,
  );
  return { onRestore };
}

/** The edit happened two hours before the fixed "now" these tests run at. */
const TWO_HOURS_IN = "2026-09-29T10:15:30.123Z";

describe("the record of a card's latest edit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-29T12:15:30.123Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("names the buddy, the moment and what the undo will do", () => {
    renderStrip();

    expect(screen.getByText(/your buddy rewrote this/i)).toBeInTheDocument();
    expect(screen.getByText(/2 h ago/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /undo — put the note back to what it said before your buddy's edit/i,
      }),
    ).toBeInTheDocument();
  });

  it("never labels the hire's own edit as the buddy's", () => {
    renderStrip({ previous: { replacedBy: "HIRE" } });

    expect(screen.getByText(/you edited this/i)).toBeInTheDocument();
    expect(screen.queryByText(/buddy/i)).not.toBeInTheDocument();
  });

  it("says a tick was a tick, when the snapshot is that tick's", () => {
    renderStrip({
      lastChange: { change: "TICKED", by: "BUDDY", at: TWO_HOURS_IN },
    });

    expect(screen.getByText(/your buddy changed the ticks/i)).toBeInTheDocument();
  });

  it("keeps calling it an edit when something else happened afterwards", () => {
    // A reorder is the card's latest change but not this version's, so the words stay about the
    // edit the snapshot actually came from.
    renderStrip({
      lastChange: { change: "MOVED", by: "BUDDY", at: "2026-09-29T11:00:00.000Z" },
    });

    expect(screen.getByText(/your buddy rewrote this/i)).toBeInTheDocument();
  });

  it("shows the previous words only when asked, and says what it discloses", () => {
    renderStrip();

    const toggle = screen.getByRole("button", { name: "Show what it said before" });
    const panel = screen.getByTestId("card-edit-history-previous");

    // The panel stays in the DOM while closed — hidden, not absent — so the reference the
    // disclosure points at always resolves for the assistive tech reading it.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("hidden");
    expect(screen.queryByText("deploys are on Wednesdays")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getByText("deploys are on Wednesdays")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide what it said before" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("echoes the exact moment of the edit it is undoing", () => {
    const { onRestore } = renderStrip();

    fireEvent.click(screen.getByRole("button", { name: /undo — put the note back/i }));

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith("c1", TWO_HOURS_IN);
  });

  it("renders a checklist snapshot read-only — no second edit path", () => {
    renderStrip({
      previous: {
        content: {
          kind: "CHECKLIST",
          title: "First week",
          items: [
            { id: "i1", text: "Get access", done: true },
            { id: "i2", text: "Run the app", done: false },
          ],
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Show what it said before" }));

    expect(screen.getByText("Get access")).toBeInTheDocument();
    expect(screen.getByText("Run the app")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("renders a link snapshot as text, not as a link to reopen", () => {
    renderStrip({
      previous: {
        content: { kind: "LINK", url: "https://example.test/handbook", label: "Handbook" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Show what it said before" }));

    expect(screen.getByText("Handbook")).toBeInTheDocument();
    expect(screen.getByText("https://example.test/handbook")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says a stale undo plainly, on the card rather than in a toast", () => {
    renderStrip({ notice: "stale" });

    expect(screen.getByText(/that edit was already replaced/i)).toBeInTheDocument();
  });

  it("announces a restore to a screen reader", () => {
    renderStrip({ notice: "restored" });

    expect(screen.getByRole("status")).toHaveTextContent(
      /restored — the note says what it said before/i,
    );
  });

  it("says something true when the wire carries an author it has never met", () => {
    // A newer backend's actor must not take the card down with it — the strip falls back to plain
    // words rather than indexing a name it does not know.
    renderStrip({ previous: { replacedBy: "SYSTEM" as unknown as BoardActor } });

    expect(screen.getByText(/this card was edited/i)).toBeInTheDocument();
  });

  it("does not put an unreadable stamp on the card as an invalid date", () => {
    renderStrip({ previous: { replacedAt: "not-a-date" } });

    expect(screen.getByText(/at an unknown time/)).toBeInTheDocument();
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
  });
});
