import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
import type { Board, BoardCard } from "../../../../src/features/board/types";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

const note = (id: string, text: string): BoardCard => ({
  id,
  kind: "NOTE",
  owner: "HIRE",
  position: 0,
  placedAt: null,
  content: { kind: "NOTE", text },
});

const task = (id: string): BoardCard => ({
  id,
  kind: "CURRENT_TASK",
  owner: "AI",
  position: 0,
  placedAt: null,
  content: {
    kind: "CURRENT_TASK",
    taskId: id,
    title: `Task ${id}`,
    summary: "A task.",
    url: null,
    closedAtSource: false,
  },
});

const boardOf = (...cards: BoardCard[]): Board => ({ boardId: "b1", projectId: "p1", cards });

function pileOf(count: number): CardStack {
  const ids = Array.from({ length: count }, (_, index) => `m${index}`);

  return {
    rootId: "m0",
    memberIds: ids,
    topId: "m0",
    remaining: count,
    members: new Map(ids.map((id) => [id, { name: `Member ${id}`, kind: "NOTE" as const }])),
  };
}

/** The wrapper around a card, which carries the hover group and the room a fanned pile takes. */
function cellOf(text: string): HTMLElement {
  const wrapper = screen.getByText(text).closest(".group\\/stack");
  if (!(wrapper instanceof HTMLElement)) throw new Error(`no cell around "${text}"`);

  return wrapper;
}

/** The element the board measures and drags, directly under the cell. */
const frameOf = (text: string) => cellOf(text).firstElementChild as HTMLElement;

describe("a card's cell", () => {
  it("is a hover group for every card, so the resize grip can appear", () => {
    render(<BoardGrid board={boardOf(note("n1", "plain note"))} />);

    expect(cellOf("plain note")).toBeInTheDocument();
  });

  it("takes no room for a fan when it is not a pile", () => {
    render(<BoardGrid board={boardOf(note("n1", "plain note"))} />);

    expect(cellOf("plain note").className).not.toMatch(/pb-/);
  });

  it("takes room for one sheet under a pile of two", () => {
    const pile = pileOf(2);
    render(
      <BoardGrid
        board={boardOf(note("m0", "top of two"))}
        stacks={new Map([["m0", pile]])}
        expandedStackIds={new Set()}
      />,
    );

    expect(cellOf("top of two").className).toContain("pb-4");
    expect(cellOf("top of two").className).not.toContain("pb-6");
  });

  it("takes room for two sheets under a pile of three, and eases into it", () => {
    const pile = pileOf(3);
    render(
      <BoardGrid
        board={boardOf(note("m0", "top of three"))}
        stacks={new Map([["m0", pile]])}
        expandedStackIds={new Set()}
      />,
    );

    expect(cellOf("top of three").className).toContain("pb-6");
    expect(cellOf("top of three").className).toContain("transition-[padding-bottom]");
  });

  it("is clickable only when it stands in for a pile", () => {
    const pile = pileOf(2);
    const { rerender } = render(
      <BoardGrid
        board={boardOf(note("m0", "top of two"))}
        stacks={new Map([["m0", pile]])}
        expandedStackIds={new Set()}
      />,
    );
    expect(frameOf("top of two").className).toContain("cursor-pointer");

    rerender(<BoardGrid board={boardOf(note("m0", "top of two"))} />);
    expect(frameOf("top of two").className).not.toContain("cursor-pointer");
  });

  it("turns off touch scrolling over a card while the board is being arranged", () => {
    const { rerender } = render(
      <BoardGrid board={boardOf(note("n1", "plain note"))} isArranging />,
    );
    expect(frameOf("plain note").style.touchAction).toBe("none");

    rerender(<BoardGrid board={boardOf(note("n1", "plain note"))} />);
    expect(frameOf("plain note").style.touchAction).toBe("");
  });

  it("names its grip after what the card is", () => {
    render(<BoardGrid board={boardOf(note("n1", "plain note"), task("t1"))} onReorder={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^move the note card/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^move the current task card/i }),
    ).toBeInTheDocument();
  });

  it("draws the sheets of a pile deepest first, each carrying its card's name", () => {
    const pile = pileOf(3);
    render(
      <BoardGrid
        board={boardOf(note("m0", "top of three"))}
        stacks={new Map([["m0", pile]])}
        expandedStackIds={new Set()}
      />,
    );

    const strips = cellOf("top of three").querySelectorAll("button[aria-hidden='true']");
    expect([...strips].map((strip) => strip.textContent)).toEqual(["Member m2", "Member m1"]);
  });

  it("keeps the sheets out of the tab order", () => {
    const pile = pileOf(2);
    render(
      <BoardGrid
        board={boardOf(note("m0", "top of two"))}
        stacks={new Map([["m0", pile]])}
        expandedStackIds={new Set()}
      />,
    );

    const strip = cellOf("top of two").querySelector("button[aria-hidden='true']");
    expect(strip).toHaveAttribute("tabindex", "-1");
  });

  it("draws no sheets when it is not a pile", () => {
    render(<BoardGrid board={boardOf(note("n1", "plain note"))} />);

    expect(cellOf("plain note").querySelectorAll("button[aria-hidden='true']")).toHaveLength(0);
  });
});

describe("opening a pile by one of its sheets", () => {
  const pile = pileOf(2);

  function renderPile(over: Partial<React.ComponentProps<typeof BoardGrid>> = {}) {
    const onToggleStack = vi.fn();
    const props = {
      stacks: new Map([
        ["m0", pile],
        ["m1", pile],
      ]),
      onToggleStack,
      ...over,
    };
    const view = render(
      <BoardGrid
        board={boardOf(note("m0", "top of two"))}
        expandedStackIds={new Set()}
        {...props}
      />,
    );

    return { onToggleStack, props, ...view };
  }

  it("asks for the pile to open, naming its root", () => {
    const { onToggleStack } = renderPile();

    cellOf("top of two").querySelector<HTMLElement>("button[aria-hidden='true']")?.click();

    expect(onToggleStack).toHaveBeenCalledWith("m0");
  });

  it("brings the card that was asked for into view once the pile is open", async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { rerender, props } = renderPile();

    cellOf("top of two").querySelector<HTMLElement>("button[aria-hidden='true']")?.click();
    rerender(
      <BoardGrid
        {...props}
        board={boardOf(note("m0", "top of two"), note("m1", "second of two"))}
        expandedStackIds={new Set(["m0"])}
      />,
    );

    await vi.waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    expect((scroll.mock.contexts[0] as HTMLElement).textContent).toContain("second of two");
    scroll.mockRestore();
  });

  it("scrolls nothing when the pile was opened some other way", async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { rerender, props } = renderPile();

    rerender(
      <BoardGrid
        {...props}
        board={boardOf(note("m0", "top of two"), note("m1", "second of two"))}
        expandedStackIds={new Set(["m0"])}
      />,
    );
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });

  it("has no sheet to press on a board that cannot open piles", () => {
    renderPile({ onToggleStack: undefined });

    const strip = cellOf("top of two").querySelector<HTMLElement>("button[aria-hidden='true']");
    expect(() => strip?.click()).not.toThrow();
  });
});
