import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DinoGame } from "../../../../../src/features/chatbot/components/DinoGame.tsx";

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
});
