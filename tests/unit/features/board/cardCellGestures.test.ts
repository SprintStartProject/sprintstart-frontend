import type { MouseEvent as ReactMouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  doubleClickHandler,
  stackClickHandler,
} from "../../../../src/features/board/components/cardCellGestures";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";

const pile: CardStack = {
  rootId: "root",
  memberIds: ["root", "next"],
  topId: "root",
  remaining: 2,
  members: new Map(),
};

function click(target: HTMLElement, detail = 1) {
  return { target, detail } as unknown as ReactMouseEvent<HTMLElement>;
}

const plain = () => document.createElement("div");
const control = () => document.createElement("button");

function selecting(text: string, collapsed: boolean) {
  const removeAllRanges = vi.fn();
  vi.spyOn(window, "getSelection").mockReturnValue({
    toString: () => text,
    isCollapsed: collapsed,
    removeAllRanges,
  } as unknown as Selection);

  return removeAllRanges;
}

afterEach(() => vi.restoreAllMocks());

describe("clicking a closed pile", () => {
  it("opens it when the click landed on nothing in particular", () => {
    const toggle = vi.fn();

    stackClickHandler(pile, false, toggle)(click(plain()));

    expect(toggle).toHaveBeenCalledWith("root");
  });

  it("does nothing for a card that is not a pile", () => {
    const toggle = vi.fn();

    stackClickHandler(undefined, false, toggle)(click(plain()));

    expect(toggle).not.toHaveBeenCalled();
  });

  it("does nothing while the board is being arranged", () => {
    const toggle = vi.fn();

    stackClickHandler(pile, true, toggle)(click(plain()));

    expect(toggle).not.toHaveBeenCalled();
  });

  it("does nothing on a board that cannot toggle a pile", () => {
    expect(() => stackClickHandler(pile, false, undefined)(click(plain()))).not.toThrow();
  });

  it("leaves the second click of a double click alone", () => {
    const toggle = vi.fn();

    stackClickHandler(pile, false, toggle)(click(plain(), 2));

    expect(toggle).not.toHaveBeenCalled();
  });

  it("leaves a click on a control to the control", () => {
    const toggle = vi.fn();

    stackClickHandler(pile, false, toggle)(click(control()));

    expect(toggle).not.toHaveBeenCalled();
  });

  it("leaves the click that ends a text selection alone", () => {
    selecting("some words", false);
    const toggle = vi.fn();

    stackClickHandler(pile, false, toggle)(click(plain()));

    expect(toggle).not.toHaveBeenCalled();
  });

  it("opens the pile when the selection is empty", () => {
    selecting("", true);
    const toggle = vi.fn();

    stackClickHandler(pile, false, toggle)(click(plain()));

    expect(toggle).toHaveBeenCalledWith("root");
  });
});

describe("double-clicking a card", () => {
  it("folds it and clears the selection the gesture left behind", () => {
    const clear = selecting("", true);
    const fold = vi.fn();

    doubleClickHandler("c1", undefined, false, fold)(click(plain()));

    expect(fold).toHaveBeenCalledWith("c1");
    expect(clear).toHaveBeenCalled();
  });

  it("does nothing while the board is being arranged", () => {
    const fold = vi.fn();

    doubleClickHandler("c1", undefined, true, fold)(click(plain()));

    expect(fold).not.toHaveBeenCalled();
  });

  it("leaves a card standing in for a pile to the pile", () => {
    const fold = vi.fn();

    doubleClickHandler("c1", pile, false, fold)(click(plain()));

    expect(fold).not.toHaveBeenCalled();
  });

  it("does nothing on a board whose cards cannot be folded", () => {
    expect(() =>
      doubleClickHandler("c1", undefined, false, undefined)(click(plain())),
    ).not.toThrow();
  });

  it("leaves a double click on a control to the control", () => {
    const fold = vi.fn();

    doubleClickHandler("c1", undefined, false, fold)(click(control()));

    expect(fold).not.toHaveBeenCalled();
  });

  it("keeps the selection when the double click landed on words", () => {
    const clear = selecting("word", false);
    const fold = vi.fn();

    doubleClickHandler("c1", undefined, false, fold)(click(plain()));

    expect(fold).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
