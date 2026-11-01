import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type { BoardGroup } from "../../../../src/features/board/layout/boardGroups";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
import type { Board, CurrentTaskContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

const task = (taskId: string): CurrentTaskContent => ({
  kind: "CURRENT_TASK",
  taskId,
  title: `Task ${taskId}`,
  summary: `About ${taskId}.`,
  url: null,
  closedAtSource: false,
});

function board(count: number): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: Array.from({ length: count }, (_, index) => ({
      id: `c${index}`,
      kind: "CURRENT_TASK" as const,
      owner: "AI" as const,
      position: index,
      placedAt: null,
      content: task(`t${index}`),
    })),
  };
}

const area = (id: string, name: string, cardIds: string[], over: Partial<BoardGroup> = {}) => ({
  id,
  name,
  cardIds,
  collapsed: false,
  ...over,
});

type Props = React.ComponentProps<typeof BoardGrid>;

describe("an area's header", () => {
  const paperwork = area("g1", "Paperwork", ["c0", "c1"]);

  function renderArea(over: Partial<Props> = {}, group: BoardGroup = paperwork) {
    return render(<BoardGrid board={board(3)} groups={[group]} {...over} />);
  }

  it("counts the cards in it", () => {
    renderArea();

    expect(screen.getByRole("region", { name: "Paperwork" })).toHaveTextContent("2");
  });

  it("is a plain heading when the area cannot be renamed", () => {
    renderArea();

    expect(screen.getByRole("heading", { name: "Paperwork" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paperwork" })).not.toBeInTheDocument();
  });

  describe("renaming", () => {
    function openName(onRenameGroup = vi.fn()) {
      renderArea({ onRenameGroup });
      fireEvent.click(screen.getByRole("button", { name: "Paperwork" }));

      return {
        onRenameGroup,
        input: screen.getByRole("textbox", { name: /name of the paperwork/i }),
      };
    }

    it("turns the name into a focused, selected field", () => {
      const { input } = openName();

      expect(input).toHaveFocus();
      expect(input).toHaveValue("Paperwork");
    });

    it("commits the new name on Enter", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "Onboarding" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onRenameGroup).toHaveBeenCalledWith("g1", "Onboarding");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("commits on blur as well", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "Onboarding" } });
      fireEvent.blur(input);

      expect(onRenameGroup).toHaveBeenCalledWith("g1", "Onboarding");
    });

    it("trims the name it commits", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "  Onboarding  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onRenameGroup).toHaveBeenCalledWith("g1", "Onboarding");
    });

    it("keeps the old name when the field is emptied", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onRenameGroup).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Paperwork" })).toBeInTheDocument();
    });

    it("does not report a name that did not change", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.keyDown(input, { key: "Enter" });

      expect(onRenameGroup).not.toHaveBeenCalled();
    });

    it("drops the draft on Escape", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "Onboarding" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onRenameGroup).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("ignores other keys", () => {
      const { input, onRenameGroup } = openName();

      fireEvent.change(input, { target: { value: "Onboarding" } });
      fireEvent.keyDown(input, { key: "a" });

      expect(onRenameGroup).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("painting", () => {
    it("offers four colours, each naming the area it paints", () => {
      renderArea({ onRecolourGroup: vi.fn() });

      expect(screen.getAllByRole("button", { name: /paint the paperwork area/i })).toHaveLength(4);
    });

    it("marks blue as chosen until another colour is", () => {
      renderArea({ onRecolourGroup: vi.fn() });

      const pressed = screen
        .getAllByRole("button", { name: /paint the paperwork area/i })
        .filter((button) => button.getAttribute("aria-pressed") === "true");
      expect(pressed.map((button) => button.getAttribute("aria-label"))).toEqual([
        "Paint the Paperwork area blue",
      ]);
    });

    it("marks the area's own colour as chosen", () => {
      renderArea({ onRecolourGroup: vi.fn() }, { ...paperwork, accent: "amber" });

      const pressed = screen
        .getAllByRole("button", { name: /paint the paperwork area/i })
        .filter((button) => button.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      expect(pressed[0]).toHaveAccessibleName(/amber/i);
    });

    it("paints the area the colour that was pressed", () => {
      const onRecolourGroup = vi.fn();
      renderArea({ onRecolourGroup });

      fireEvent.click(screen.getByRole("button", { name: /paint the paperwork area amber/i }));

      expect(onRecolourGroup).toHaveBeenCalledWith("g1", "amber");
    });

    it("offers no paint on a board that cannot be changed", () => {
      renderArea();

      expect(screen.queryByRole("button", { name: /paint the/i })).not.toBeInTheDocument();
    });
  });

  describe("taking the area away", () => {
    it("dissolves the area and leaves its cards", () => {
      const onDissolveGroup = vi.fn();
      renderArea({ onDissolveGroup });

      fireEvent.click(screen.getByRole("button", { name: "Take the Paperwork area away" }));

      expect(onDissolveGroup).toHaveBeenCalledWith("g1");
    });

    it("is not offered on a board that cannot be changed", () => {
      renderArea();

      expect(screen.queryByRole("button", { name: /take the paperwork area away/i })).toBeNull();
    });
  });

  describe("folding", () => {
    it("folds an open area and says it is open", () => {
      const onToggleGroup = vi.fn();
      renderArea({ onToggleGroup });

      const fold = screen.getByRole("button", { name: "Fold the Paperwork area" });
      expect(fold).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(fold);

      expect(onToggleGroup).toHaveBeenCalledWith("g1");
    });

    it("offers to unfold a folded area and says it is closed", () => {
      renderArea({ onToggleGroup: vi.fn() }, { ...paperwork, collapsed: true });

      expect(screen.getByRole("button", { name: "Unfold the Paperwork area" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("folds on a double click on the bar", () => {
      const onToggleGroup = vi.fn();
      renderArea({ onToggleGroup });

      fireEvent.doubleClick(screen.getByRole("heading", { name: "Paperwork" }));

      expect(onToggleGroup).toHaveBeenCalledWith("g1");
    });

    it("leaves a double click on a control to the control", () => {
      const onToggleGroup = vi.fn();
      renderArea({ onToggleGroup, onRenameGroup: vi.fn() });

      fireEvent.doubleClick(screen.getByRole("button", { name: "Paperwork" }));

      expect(onToggleGroup).not.toHaveBeenCalled();
    });

    it("ignores a double click on a board whose areas cannot be folded", () => {
      renderArea();

      expect(() =>
        fireEvent.doubleClick(screen.getByRole("heading", { name: "Paperwork" })),
      ).not.toThrow();
    });
  });

  describe("stepping through the board", () => {
    const two = [area("g1", "Paperwork", ["c0", "c1"]), area("g2", "Setup", ["c2", "c3"])];

    function renderTwo(onReorder = vi.fn()) {
      render(<BoardGrid board={board(4)} groups={two} onReorder={onReorder} />);

      return onReorder;
    }

    it.each(["ArrowDown", "ArrowRight"])("%s steps the first area past the second", (key) => {
      const onReorder = renderTwo();

      fireEvent.keyDown(screen.getByRole("button", { name: /move the paperwork area/i }), { key });

      expect(onReorder).toHaveBeenCalledWith(["c2", "c3", "c0", "c1"]);
    });

    it.each(["ArrowUp", "ArrowLeft"])("%s steps the second area in front of the first", (key) => {
      const onReorder = renderTwo();

      fireEvent.keyDown(screen.getByRole("button", { name: /move the setup area/i }), { key });

      expect(onReorder).toHaveBeenCalledWith(["c2", "c3", "c0", "c1"]);
    });

    it("does not step the first area further up", () => {
      const onReorder = renderTwo();

      fireEvent.keyDown(screen.getByRole("button", { name: /move the paperwork area/i }), {
        key: "ArrowUp",
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("does not step the last area further down", () => {
      const onReorder = renderTwo();

      fireEvent.keyDown(screen.getByRole("button", { name: /move the setup area/i }), {
        key: "ArrowDown",
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("answers only the arrow keys", () => {
      const onReorder = renderTwo();

      const grip = screen.getByRole("button", { name: /move the paperwork area/i });
      fireEvent.keyDown(grip, { key: "Enter" });
      fireEvent.keyDown(grip, { key: "a" });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("has no grip when the board cannot be reordered", () => {
      render(<BoardGrid board={board(4)} groups={two} />);

      expect(screen.queryByRole("button", { name: /move the paperwork area/i })).toBeNull();
    });
  });
});

describe("a card's own controls", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  describe("moving with the keyboard", () => {
    function renderMovable(onReorder = vi.fn()) {
      render(<BoardGrid board={board(3)} onReorder={onReorder} />);

      return {
        onReorder,
        grip: (index: number) =>
          screen.getAllByRole("button", { name: /^move the .* card/i })[index],
      };
    }

    it.each(["ArrowDown", "ArrowRight"])("%s moves a card one place on", (key) => {
      const { grip, onReorder } = renderMovable();

      fireEvent.keyDown(grip(0), { key });

      expect(onReorder).toHaveBeenCalledWith(["c1", "c0", "c2"]);
    });

    it.each(["ArrowUp", "ArrowLeft"])("%s moves a card one place back", (key) => {
      const { grip, onReorder } = renderMovable();

      fireEvent.keyDown(grip(2), { key });

      expect(onReorder).toHaveBeenCalledWith(["c0", "c2", "c1"]);
    });

    it("keeps the first card where it is when asked to go back", () => {
      const { grip, onReorder } = renderMovable();

      fireEvent.keyDown(grip(0), { key: "ArrowUp" });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("keeps the last card where it is when asked to go on", () => {
      const { grip, onReorder } = renderMovable();

      fireEvent.keyDown(grip(2), { key: "ArrowDown" });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("answers only the arrow keys", () => {
      const { grip, onReorder } = renderMovable();

      fireEvent.keyDown(grip(1), { key: "Enter" });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("moves a card across hidden ones by the order the board really has", () => {
      const onReorder = vi.fn();
      render(
        <BoardGrid board={board(2)} boardOrder={["c0", "hidden", "c1"]} onReorder={onReorder} />,
      );

      fireEvent.keyDown(screen.getAllByRole("button", { name: /^move the .* card/i })[0], {
        key: "ArrowDown",
      });

      expect(onReorder).toHaveBeenCalledWith(["hidden", "c1", "c0"]);
    });

    it("offers no grip when the board cannot be reordered", () => {
      render(<BoardGrid board={board(3)} />);

      expect(screen.queryByRole("button", { name: /^move the .* card/i })).toBeNull();
    });
  });

  describe("resizing", () => {
    function renderResizable(over: Partial<Props> = {}) {
      const onResizeCard = vi.fn();
      render(<BoardGrid board={board(1)} onResizeCard={onResizeCard} {...over} />);

      return { onResizeCard, handle: screen.getByRole("button", { name: /^resize the .* card/i }) };
    }

    function press(handle: HTMLElement, x: number) {
      handle.setPointerCapture = vi.fn();
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: x, clientY: 0 });
    }

    it("widens a card by one step per 48px dragged right", () => {
      const { handle, onResizeCard } = renderResizable();

      press(handle, 100);
      fireEvent.pointerMove(handle, { clientX: 147 });
      expect(onResizeCard).not.toHaveBeenCalled();

      fireEvent.pointerMove(handle, { clientX: 148 });
      expect(onResizeCard).toHaveBeenCalledWith("c0", { width: "wide" });
    });

    it("narrows a card by one step per 48px dragged left", () => {
      const { handle, onResizeCard } = renderResizable();

      press(handle, 100);
      fireEvent.pointerMove(handle, { clientX: 52 });

      expect(onResizeCard).toHaveBeenCalledWith("c0", { width: "narrow" });
    });

    it("does nothing for a drag that stays within one step", () => {
      const { handle, onResizeCard } = renderResizable();

      press(handle, 100);
      fireEvent.pointerMove(handle, { clientX: 110 });

      expect(onResizeCard).not.toHaveBeenCalled();
    });

    it("captures the pointer so the drag survives leaving the handle", () => {
      const { handle } = renderResizable();

      press(handle, 100);

      expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it("ignores movement that did not start on the handle", () => {
      const { handle, onResizeCard } = renderResizable();

      fireEvent.pointerMove(handle, { clientX: 400 });

      expect(onResizeCard).not.toHaveBeenCalled();
    });

    it("stops resizing once the pointer is released", () => {
      const { handle, onResizeCard } = renderResizable();

      press(handle, 100);
      fireEvent.pointerUp(handle);
      fireEvent.pointerMove(handle, { clientX: 300 });

      expect(onResizeCard).not.toHaveBeenCalled();
    });

    it("stops resizing when the pointer is cancelled", () => {
      const { handle, onResizeCard } = renderResizable();

      press(handle, 100);
      fireEvent.pointerCancel(handle);
      fireEvent.pointerMove(handle, { clientX: 300 });

      expect(onResizeCard).not.toHaveBeenCalled();
    });

    it("steps the same ramp from the keyboard", () => {
      const { handle, onResizeCard } = renderResizable();

      fireEvent.keyDown(handle, { key: "ArrowRight" });
      expect(onResizeCard).toHaveBeenLastCalledWith("c0", { width: "wide" });

      fireEvent.keyDown(handle, { key: "ArrowLeft" });
      expect(onResizeCard).toHaveBeenLastCalledWith("c0", { width: "narrow" });
    });

    it("lets other keys through", () => {
      const { handle, onResizeCard } = renderResizable();

      const notPrevented = fireEvent.keyDown(handle, { key: "ArrowDown" });

      expect(notPrevented).toBe(true);
      expect(onResizeCard).not.toHaveBeenCalled();
    });

    it("keeps the arrow key from also scrolling the page", () => {
      const { handle } = renderResizable();

      expect(fireEvent.keyDown(handle, { key: "ArrowRight" })).toBe(false);
    });

    it("starts from the size the card already has", () => {
      const { handle, onResizeCard } = renderResizable({ cardSizes: { c0: { width: "wide" } } });

      fireEvent.keyDown(handle, { key: "ArrowRight" });

      expect(onResizeCard).toHaveBeenCalledWith("c0", { width: "wide" });
      fireEvent.keyDown(handle, { key: "ArrowLeft" });
      expect(onResizeCard).toHaveBeenLastCalledWith("c0", { width: "normal" });
    });

    it("is not offered while the board is being arranged", () => {
      render(<BoardGrid board={board(1)} onResizeCard={vi.fn()} isArranging />);

      expect(screen.queryByRole("button", { name: /^resize the .* card/i })).toBeNull();
    });

    it("is not offered when sizes cannot be changed", () => {
      render(<BoardGrid board={board(1)} />);

      expect(screen.queryByRole("button", { name: /^resize the .* card/i })).toBeNull();
    });
  });

  describe("choosing its pile while the board is arranged", () => {
    function renderPicker(over: Partial<Props> = {}) {
      const onStackOnto = vi.fn();
      render(<BoardGrid board={board(3)} isArranging onStackOnto={onStackOnto} {...over} />);

      return {
        onStackOnto,
        picker: (index: number) =>
          screen.getAllByRole("combobox", { name: /^put the .* card in a pile/i })[index],
      };
    }

    it("lists every other card by name, and not itself", () => {
      const { picker } = renderPicker();

      const options = within(picker(0)).getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent("Not in a pile");
      expect(options[1]).toHaveTextContent(/^Under/);
    });

    it("piles the card under the one that was chosen", () => {
      const { picker, onStackOnto } = renderPicker();

      fireEvent.change(picker(0), { target: { value: "c2" } });

      expect(onStackOnto).toHaveBeenCalledWith("c0", "c2");
    });

    it("takes the card out of its pile when the empty choice is made", () => {
      const { picker, onStackOnto } = renderPicker();

      fireEvent.change(picker(0), { target: { value: "c2" } });
      fireEvent.change(picker(0), { target: { value: "" } });

      expect(onStackOnto).toHaveBeenLastCalledWith("c0", null);
    });

    it("says a pile's top card is the top of its pile", () => {
      const pile: CardStack = {
        rootId: "c0",
        memberIds: ["c0", "c1"],
        topId: "c0",
        remaining: 2,
        members: new Map(),
      };
      const { picker } = renderPicker({
        stacks: new Map([
          ["c0", pile],
          ["c1", pile],
        ]),
        expandedStackIds: new Set(["c0"]),
      });

      expect(within(picker(0)).getAllByRole("option")[0]).toHaveTextContent("Top of its pile");
      expect(within(picker(1)).getAllByRole("option")[0]).toHaveTextContent("Not in a pile");
    });

    it("is only offered while arranging", () => {
      render(<BoardGrid board={board(3)} onStackOnto={vi.fn()} />);

      expect(screen.queryByRole("combobox", { name: /in a pile/i })).toBeNull();
    });
  });

  describe("a closed pile opened by clicking it", () => {
    const pile: CardStack = {
      rootId: "c0",
      memberIds: ["c0", "c1"],
      topId: "c0",
      remaining: 2,
      members: new Map(),
    };

    function renderPile(over: Partial<Props> = {}) {
      const onToggleStack = vi.fn();
      render(
        <BoardGrid
          board={board(1)}
          stacks={new Map([["c0", pile]])}
          expandedStackIds={new Set()}
          onToggleStack={onToggleStack}
          {...over}
        />,
      );

      return { onToggleStack, body: screen.getByText("About t0.") };
    }

    it("opens on a click that landed on nothing in particular", () => {
      const { body, onToggleStack } = renderPile();

      fireEvent.click(body);

      expect(onToggleStack).toHaveBeenCalledWith("c0");
    });

    it("stays shut on the second click of a double click", () => {
      const { body, onToggleStack } = renderPile();

      fireEvent.click(body, { detail: 2 });

      expect(onToggleStack).not.toHaveBeenCalled();
    });

    it("stays shut while text is selected", () => {
      const { body, onToggleStack } = renderPile();
      vi.spyOn(window, "getSelection").mockReturnValue({
        toString: () => "About",
        removeAllRanges: vi.fn(),
      } as unknown as Selection);

      fireEvent.click(body);

      expect(onToggleStack).not.toHaveBeenCalled();
    });

    it("stays shut while the board is being arranged", () => {
      const { body, onToggleStack } = renderPile({ isArranging: true });

      fireEvent.click(body);

      expect(onToggleStack).not.toHaveBeenCalled();
    });

    it("leaves a click on a control to the control", () => {
      const { onToggleStack } = renderPile();
      const header = screen.getByText("About t0.").closest("div") as HTMLElement;
      const button = document.createElement("button");
      header.appendChild(button);

      fireEvent.click(button);

      expect(onToggleStack).not.toHaveBeenCalled();
    });

    it("is not a pile at all when the board cannot toggle one", () => {
      const { body } = renderPile({ onToggleStack: undefined });

      expect(() => fireEvent.click(body)).not.toThrow();
    });
  });
});
