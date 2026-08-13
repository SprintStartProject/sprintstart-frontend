import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpaceInvadersModal } from "../../../../src/features/space-invaders/components/SpaceInvadersModal";

describe("SpaceInvadersModal", () => {
  it("renders the modal with the game when open", () => {
    render(<SpaceInvadersModal open={true} onClose={vi.fn()} />);

    // SpaceInvaders exposes its own aria-label on the role="application" container.
    const game = screen.getByLabelText(
      "Mini space invaders game — arrow keys or A/D move, space shoots, escape exits",
    );
    expect(game).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(<SpaceInvadersModal open={false} onClose={vi.fn()} />);
    expect(
      screen.queryByLabelText(
        "Mini space invaders game — arrow keys or A/D move, space shoots, escape exits",
      ),
    ).not.toBeInTheDocument();
  });

  it("has the correct dialog attributes", () => {
    render(<SpaceInvadersModal open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Space Invaders game");
  });

  it("calls onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    render(<SpaceInvadersModal open={true} onClose={onClose} />);
    // The dialog overlay is the element with role="dialog".
    const overlay = screen.getByRole("dialog");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed (routed through SpaceInvaders' own handler)", () => {
    const onClose = vi.fn();
    render(<SpaceInvadersModal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when Escape is pressed while closed", () => {
    const onClose = vi.fn();
    render(<SpaceInvadersModal open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the play-again and exit buttons with data-testids", () => {
    render(<SpaceInvadersModal open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("invaders-exit")).toBeInTheDocument();
  });
});
