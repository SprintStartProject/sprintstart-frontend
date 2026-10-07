import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DinoGame } from "../../../../src/features/easter-eggs/components/DinoGame.tsx";

/**
 * The game chrome around the canvas: what it tells assistive tech, and how it hands Escape
 * back to its host. The canvas loop itself is not exercised (jsdom has no 2D context).
 */
describe("DinoGame chrome", () => {
  it("keeps the running score out of the accessibility tree", () => {
    render(<DinoGame onExit={vi.fn()} />);
    const status = screen.getByTestId("dino-game-status");
    // The one live region stays quiet while the game runs.
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("");
    // The game itself is not a live region.
    expect(screen.getByTestId("dino-game").closest("[aria-live]")).toBeNull();
  });

  it("announces the completion once, with a text label", () => {
    render(<DinoGame onExit={vi.fn()} replyReady />);
    expect(screen.getByTestId("dino-game-status")).toHaveTextContent("Reply ready");
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveAttribute("data-tone", "success");
  });

  it("labels a non-success outcome in words, not only colour", () => {
    render(
      <DinoGame
        onExit={vi.fn()}
        replyReady
        completionLabel="Stopped"
        completionTone="neutral"
        continueLabel="Back to chat"
      />,
    );
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent("Stopped");
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByTestId("dino-game-status")).toHaveTextContent("Stopped");
  });

  it("claims Escape before document listeners see it", () => {
    const onExit = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener("keydown", documentListener);
    render(<DinoGame onExit={onExit} />);

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", documentListener);
  });

  it("exits from the close button", () => {
    const onExit = vi.fn();
    render(<DinoGame onExit={onExit} />);
    fireEvent.click(screen.getByTestId("dino-game-close"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("renders even when localStorage refuses to be read", () => {
    // Privacy modes and sandboxed frames can throw on access; a lost high
    // score is fine, a broken render is not.
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });
    render(<DinoGame onExit={vi.fn()} />);

    expect(screen.getByTestId("dino-game")).toBeInTheDocument();
    expect(screen.getByTestId("dino-game-close")).toBeInTheDocument();
    getItem.mockRestore();
  });

  it("speaks touch on coarse pointers and keys elsewhere", () => {
    render(<DinoGame onExit={vi.fn()} />);

    // Keyboard copy hides on touch devices, where those keys do not exist...
    expect(screen.getByText("Hold Space = high jump · ↓ duck").className).toContain(
      "pointer-coarse:hidden",
    );
    // ...and the touch copy shows there instead.
    const touchHint = screen.getByText("Tap = jump · hold = higher");
    const touchClasses = touchHint.className.split(/\s+/);
    expect(touchClasses).toContain("hidden");
    expect(touchClasses).toContain("pointer-coarse:inline");
    // The key-name suffix on the exit affordance follows the same rule.
    expect(screen.getByText("Esc ✕").className).toContain("pointer-coarse:hidden");
  });
});
