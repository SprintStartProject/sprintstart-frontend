import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpandedStack } from "../../../../src/features/board/components/ExpandedStack";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";

const stack: CardStack = {
  rootId: "c0",
  memberIds: ["c0", "c1", "c2"],
  topId: "c1",
  remaining: 2,
  members: new Map(),
};

function renderStack(onCollapse?: () => void) {
  render(
    <ExpandedStack stack={stack} onCollapse={onCollapse}>
      <p>First card</p>
      <p>Second card</p>
      <p>Third card</p>
    </ExpandedStack>,
  );

  return screen.getByRole("region", { name: "Sequence of 3 cards" });
}

describe("an opened pile", () => {
  it("is named by how many cards it holds, and is the frame the click-away handler recognises", () => {
    const frame = renderStack();

    expect(frame).toHaveAttribute("data-stack-root", "c0");
  });

  it("says how many cards there are and how many are still to do", () => {
    const frame = renderStack();

    expect(frame).toHaveTextContent("3 cards, in order · 2 still to do");
  });

  it("numbers the cards in the order they are to be worked", () => {
    const frame = renderStack();

    const items = within(frame).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(String(index + 1));
    });
    expect(items[0]).toHaveTextContent("First card");
    expect(items[2]).toHaveTextContent("Third card");
  });

  it("puts the pile back together on request", () => {
    const onCollapse = vi.fn();
    renderStack(onCollapse);

    fireEvent.click(screen.getByRole("button", { name: "Put back" }));

    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("offers no way back on a board whose piles cannot be opened", () => {
    renderStack();

    expect(screen.queryByRole("button", { name: "Put back" })).not.toBeInTheDocument();
  });
});
