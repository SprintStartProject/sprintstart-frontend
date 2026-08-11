import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DinoGameModal } from "../../../../src/features/dino/components/DinoGameModal";

describe("DinoGameModal", () => {
  it("renders the modal with the dino game when open", () => {
    render(<DinoGameModal open={true} onClose={vi.fn()} />);

    // DinoGame exposes its own aria-label on the role="application" container.
    const game = screen.getByLabelText(
      "Mini dino game — space jumps (hold for higher), arrow down ducks, escape exits",
    );
    expect(game).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(<DinoGameModal open={false} onClose={vi.fn()} />);
    expect(
      screen.queryByLabelText(
        "Mini dino game — space jumps (hold for higher), arrow down ducks, escape exits",
      ),
    ).not.toBeInTheDocument();
  });

  it("has the correct dialog attributes", () => {
    render(<DinoGameModal open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Dino game");
  });

  it("calls onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    render(<DinoGameModal open={true} onClose={onClose} />);
    // The dialog overlay is the element with role="dialog".
    const overlay = screen.getByRole("dialog");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed (routed through DinoGame's own handler)", () => {
    const onClose = vi.fn();
    render(<DinoGameModal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when Escape is pressed while closed", () => {
    const onClose = vi.fn();
    render(<DinoGameModal open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
