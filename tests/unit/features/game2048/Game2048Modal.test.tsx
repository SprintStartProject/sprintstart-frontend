import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Game2048Modal } from "../../../../src/features/game2048/components/Game2048Modal";

describe("Game2048Modal", () => {
  it("renders the modal with iframe when open", () => {
    render(<Game2048Modal open={true} onClose={vi.fn()} />);

    const iframe = screen.getByTitle("2048 game");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "/easter-eggs/2048.html");
  });

  it("renders nothing when closed", () => {
    render(<Game2048Modal open={false} onClose={vi.fn()} />);
    expect(screen.queryByTitle("2048 game")).not.toBeInTheDocument();
  });

  it("renders the close button with aria-label", () => {
    render(<Game2048Modal open={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Close 2048 game")).toBeInTheDocument();
  });

  it("renders the dialog title", () => {
    render(<Game2048Modal open={true} onClose={vi.fn()} />);
    expect(screen.getByText("2048")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<Game2048Modal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close 2048 game"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    render(<Game2048Modal open={true} onClose={onClose} />);
    // The dialog overlay is the element with role="dialog".
    const overlay = screen.getByRole("dialog");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has the correct dialog attributes", () => {
    render(<Game2048Modal open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "game2048-title");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Game2048Modal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when Escape is pressed while closed", () => {
    const onClose = vi.fn();
    render(<Game2048Modal open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
