import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import { AddCardForm } from "../../../../src/features/board/components/AddCardForm";
import type { Board, BoardCard, BoardCardContent } from "../../../../src/features/board/types";

function board(cards: BoardCardContent[]): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: cards.map((content, index): BoardCard => ({
      id: `c${index}`,
      kind: content.kind,
      // Authored cards are the hire's; live ones are not.
      owner:
        content.kind === "NOTE" || content.kind === "LINK" || content.kind === "CHECKLIST"
          ? "HIRE"
          : "AI",
      position: index,
      placedAt: null,
      content,
    })),
  };
}

const note = (text = "deploys are on Thursdays"): BoardCardContent => ({ kind: "NOTE", text });

const checklist = (
  items: { id: string; text: string; done: boolean }[],
  title: string | null = "Set-up",
): BoardCardContent => ({ kind: "CHECKLIST", title, items });

describe("the cards the hire writes", () => {
  it("claims nothing about who added a card the hire wrote", () => {
    render(<BoardGrid board={board([note()])} />);

    expect(screen.queryByText("Buddy added this")).not.toBeInTheDocument();
    expect(screen.queryByText("Kept for you")).not.toBeInTheDocument();
  });

  it("heads a note with its own first line and keeps the rest beneath", () => {
    render(<BoardGrid board={board([note("one\ntwo")])} />);

    // A card headed "Note" told the hire nothing they could not already see. The note names
    // itself, and nothing of what they typed is dropped to do it.
    expect(screen.getByRole("heading", { name: "one" })).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("shows a one-line note as its own heading, with no body repeating it", () => {
    render(<BoardGrid board={board([note("deploys are on Thursdays")])} />);

    expect(screen.getByRole("heading", { name: "deploys are on Thursdays" })).toBeInTheDocument();
    expect(screen.getAllByText("deploys are on Thursdays")).toHaveLength(1);
  });

  it("edits a note in place rather than sending the hire elsewhere", () => {
    const onEdit = vi.fn();
    render(<BoardGrid board={board([note("Deploys\nare on Thursdays")])} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /edit this note/i }));
    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "are on Wednesdays" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Title and body are edited apart and stored as one text: the first line is the heading, which
    // is exactly what the card reads back off it. Nothing about the wire format changed.
    expect(onEdit).toHaveBeenCalledWith("c0", {
      kind: "NOTE",
      text: "Deploys\nare on Wednesdays",
    });
  });

  it("keeps a note that is only a title", () => {
    const onEdit = vi.fn();
    render(<BoardGrid board={board([note("Deploys\nare on Thursdays")])} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /edit this note/i }));
    fireEvent.change(screen.getByLabelText("Note text"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // A heading on its own is a note worth keeping — "Ask Mia about deploys" needs no body.
    expect(onEdit).toHaveBeenCalledWith("c0", { kind: "NOTE", text: "Deploys" });
  });

  it("will not save a note the hire has emptied", () => {
    render(<BoardGrid board={board([note()])} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /edit this note/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "  " } });
    fireEvent.change(screen.getByLabelText("Note text"), { target: { value: "   " } });

    // Same rule the server enforces: a blank card nobody can explain is worse than a wait. Both
    // fields have to be empty for that — either one alone is still a note.
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("offers no edit control when editing is not offered", () => {
    render(<BoardGrid board={board([note()])} />);

    expect(screen.queryByRole("button", { name: /edit this note/i })).not.toBeInTheDocument();
  });

  it("shows a link URL when the hire gave it no name", () => {
    render(
      <BoardGrid
        board={board([{ kind: "LINK", url: "https://example.test/runbook", label: null }])}
      />,
    );

    // Deriving a title from the address would be the board naming something the hire chose
    // not to name.
    expect(screen.getByRole("link")).toHaveTextContent("https://example.test/runbook");
  });

  it("ticking an item sends the whole list back with that item id intact", () => {
    const onEdit = vi.fn();
    render(
      <BoardGrid
        board={board([
          checklist([
            { id: "i1", text: "clone the repo", done: false },
            { id: "i2", text: "run the tests", done: false },
          ]),
        ])}
        onEdit={onEdit}
      />,
    );

    fireEvent.click(screen.getByLabelText("clone the repo"));

    // The id is what makes a tick an edit to that line rather than to a position.
    expect(onEdit).toHaveBeenCalledWith("c0", {
      kind: "CHECKLIST",
      title: "Set-up",
      items: [
        { id: "i1", text: "clone the repo", done: true },
        { id: "i2", text: "run the tests", done: false },
      ],
    });
  });

  it("a new item is sent without an id, for the server to mint", () => {
    const onEdit = vi.fn();
    render(
      <BoardGrid
        board={board([checklist([{ id: "i1", text: "clone the repo", done: false }])])}
        onEdit={onEdit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add an item"), {
      target: { value: "read the runbook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add this item" }));

    // Minted server-side, so two tabs adding a line cannot mint the same id.
    expect(onEdit.mock.calls[0][1].items[1]).toEqual({ text: "read the runbook", done: false });
  });

  it("counts a checklist rather than scoring it", () => {
    render(
      <BoardGrid
        board={board([
          checklist([
            { id: "i1", text: "clone the repo", done: true },
            { id: "i2", text: "run the tests", done: false },
          ]),
        ])}
      />,
    );

    // A list somebody wrote for themselves is not a progress metric.
    expect(screen.getByText("1/2 done")).toBeInTheDocument();
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
  });
});

describe("arranging the board", () => {
  /** The grip on a card, which is both the drag handle and the keyboard control. */
  function grips() {
    return screen.getAllByRole("button", { name: /move the note card/i });
  }

  it("moving a card sends the whole resulting order", () => {
    const onReorder = vi.fn();
    render(<BoardGrid board={board([note("first"), note("second")])} onReorder={onReorder} />);

    fireEvent.keyDown(grips()[0], { key: "ArrowDown" });

    // Never a from/to pair: the whole resulting order, because that is what the board now is.
    expect(onReorder).toHaveBeenCalledWith(["c1", "c0"]);
  });

  it("cannot move the first card earlier or the last one later", () => {
    const onReorder = vi.fn();
    render(<BoardGrid board={board([note("first"), note("second")])} onReorder={onReorder} />);

    fireEvent.keyDown(grips()[0], { key: "ArrowUp" });
    fireEvent.keyDown(grips()[1], { key: "ArrowDown" });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("offers a keyboard-reachable grip rather than a drag alone", () => {
    render(<BoardGrid board={board([note(), note()])} onReorder={vi.fn()} />);

    // A board you can only arrange with a mouse is a board some people cannot arrange. One grip
    // per card, and the arrow keys move it while it has focus — the label says so.
    expect(grips().length).toBe(2);
    expect(grips()[0]).toHaveAccessibleName(/arrow keys/i);
  });

  it("has no grip when the board is not arrangeable", () => {
    render(<BoardGrid board={board([note(), note()])} />);

    expect(screen.queryByRole("button", { name: /move the/i })).not.toBeInTheDocument();
  });
});

describe("folding and pinning", () => {
  it("folds a card down to its header and back", () => {
    const onToggle = vi.fn();
    render(
      <BoardGrid
        board={board([note("Deploys\nare on Thursdays")])}
        collapsedIds={new Set(["c0"])}
        onToggleCollapsed={onToggle}
      />,
    );

    // Folded: the heading is still the card's own first line, the body is not rendered.
    expect(screen.getByRole("heading", { name: "Deploys" })).toBeInTheDocument();
    expect(screen.queryByText("are on Thursdays")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /unfold the note card/i }));
    expect(onToggle).toHaveBeenCalledWith("c0");
  });

  it("says a card is pinned rather than only putting it on top", () => {
    const onPin = vi.fn();
    render(
      <BoardGrid
        board={board([note("first")])}
        pinnedIds={new Set(["c0"])}
        onTogglePinned={onPin}
      />,
    );

    // Position alone is a state the hire cannot read: the pin carries an icon and a word.
    expect(screen.getByText("Pinned")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /unpin the note card/i }));
    expect(onPin).toHaveBeenCalledWith("c0");
  });
});

describe("AddCardForm", () => {
  it("adds a note once it would say something", () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<AddCardForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /note/i }));
    fireEvent.change(screen.getByLabelText(/what do you want to remember/i), {
      target: { value: "deploys are on Thursdays" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to my board/i }));

    expect(onAdd).toHaveBeenCalledWith({ kind: "NOTE", text: "deploys are on Thursdays" });
  });

  it("waits until a note has content", () => {
    render(<AddCardForm onAdd={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /note/i }));

    expect(screen.getByRole("button", { name: /add to my board/i })).toBeDisabled();
  });

  it("lets an empty checklist be made — that is a list about to be filled in", () => {
    render(<AddCardForm onAdd={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /checklist/i }));

    expect(screen.getByRole("button", { name: /add to my board/i })).toBeEnabled();
  });

  it("keeps a link label optional", () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<AddCardForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /link/i }));
    fireEvent.change(screen.getByLabelText(/which link do you want to keep/i), {
      target: { value: "https://example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to my board/i }));

    expect(onAdd).toHaveBeenCalledWith({
      kind: "LINK",
      url: "https://example.test",
      label: null,
    });
  });
});
