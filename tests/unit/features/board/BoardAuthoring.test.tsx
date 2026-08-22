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

  it("shows a note as the hire typed it, line breaks and all", () => {
    render(<BoardGrid board={board([note("one\ntwo")])} />);

    expect(screen.getByText(/one\s+two/)).toBeInTheDocument();
  });

  it("edits a note in place rather than sending the hire elsewhere", () => {
    const onEdit = vi.fn();
    render(<BoardGrid board={board([note()])} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /edit this note/i }));
    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "deploys are on Wednesdays" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEdit).toHaveBeenCalledWith("c0", {
      kind: "NOTE",
      text: "deploys are on Wednesdays",
    });
  });

  it("will not save a note the hire has emptied", () => {
    render(<BoardGrid board={board([note()])} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /edit this note/i }));
    fireEvent.change(screen.getByLabelText("Note text"), { target: { value: "   " } });

    // Same rule the server enforces: a blank card nobody can explain is worse than a wait.
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
  it("moving a card sends the whole resulting order", () => {
    const onReorder = vi.fn();
    render(<BoardGrid board={board([note("first"), note("second")])} onReorder={onReorder} />);

    fireEvent.click(screen.getAllByRole("button", { name: /move the note card later/i })[0]);

    expect(onReorder).toHaveBeenCalledWith(["c1", "c0"]);
  });

  it("cannot move the first card earlier or the last one later", () => {
    render(<BoardGrid board={board([note("first"), note("second")])} onReorder={vi.fn()} />);

    expect(
      screen.getAllByRole("button", { name: /move the note card earlier/i })[0],
    ).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /move the note card later/i })[1]).toBeDisabled();
  });

  it("offers keyboard-reachable buttons rather than a drag alone", () => {
    render(<BoardGrid board={board([note(), note()])} onReorder={vi.fn()} />);

    // A board you can only arrange with a mouse is a board some people cannot arrange.
    expect(screen.getAllByRole("button", { name: /move the note card/i }).length).toBe(4);
  });

  it("has no move controls when the board is not arrangeable", () => {
    render(<BoardGrid board={board([note(), note()])} />);

    expect(screen.queryByRole("button", { name: /move the/i })).not.toBeInTheDocument();
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
