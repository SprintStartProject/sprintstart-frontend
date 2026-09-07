import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MarkPopover } from "../../../../src/features/board/components/MarkPopover";

const nameColor = vi.fn();

vi.mock("../../../../src/features/board/marks/useCardMarks", () => ({
  useCardMarks: () => ({
    labels: { green: "ask about" },
    nameColor,
  }),
}));

/** Where a highlight is on screen. Only the geometry the bar positions itself against. */
function anchor(): DOMRect {
  return { top: 100, bottom: 120, left: 200, right: 300, width: 100, height: 20 } as DOMRect;
}

function open(overrides: Partial<Parameters<typeof MarkPopover>[0]> = {}) {
  const props = {
    anchor: anchor(),
    color: "yellow" as const,
    onPick: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  render(<MarkPopover {...props} />);
  return props;
}

describe("the bar that opens on one of the hire's own highlights", () => {
  beforeEach(() => nameColor.mockReset());

  it("says which colour the highlight already carries", () => {
    open({ color: "blue" });

    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pink" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls the colour by the hire's own word for it where they have written one", () => {
    open();

    // The colour's own word is a fallback, never a value — see `marks/markLabels.ts`.
    expect(screen.getByRole("button", { name: "ask about" })).toBeInTheDocument();
  });

  it("repaints the highlight", () => {
    const { onPick } = open();

    fireEvent.click(screen.getByRole("button", { name: "ask about" }));

    expect(onPick).toHaveBeenCalledWith("green");
  });

  it("rubs the highlight out", () => {
    const { onRemove } = open();

    fireEvent.click(screen.getByRole("button", { name: "Remove this highlight" }));

    expect(onRemove).toHaveBeenCalled();
  });

  it("closes on Escape, and on a press anywhere else", () => {
    const { onClose } = open();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("stays open while the press is on the bar itself", () => {
    const { onClose } = open();

    fireEvent.mouseDown(screen.getByRole("toolbar"));

    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * Naming a colour lives here and nowhere else: this is the one moment somebody is looking at a
   * sentence they marked, which is the only moment "what does green mean to me" is a real question.
   */
  it("names the colour that is on this highlight, and comes back to the swatches", () => {
    open({ color: "green" });

    fireEvent.click(screen.getByRole("button", { name: "Rename ask about" }));

    const field = screen.getByRole("textbox", { name: "What ask about means" });
    // Seeded with their word alone, so clearing a name is not typing over one the app suggested.
    expect(field).toHaveValue("ask about");

    fireEvent.change(field, { target: { value: "read again" } });
    fireEvent.click(screen.getByRole("button", { name: "Save this name" }));

    expect(nameColor).toHaveBeenCalledWith("green", "read again");
    expect(screen.getByRole("button", { name: "Remove this highlight" })).toBeInTheDocument();
  });

  it("leaves the name alone when the rename is abandoned", () => {
    open({ color: "green" });

    fireEvent.click(screen.getByRole("button", { name: "Rename ask about" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What ask about means" }), {
      target: { value: "read again" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "What ask about means" }), {
      key: "Escape",
    });

    expect(nameColor).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove this highlight" })).toBeInTheDocument();
  });
});
