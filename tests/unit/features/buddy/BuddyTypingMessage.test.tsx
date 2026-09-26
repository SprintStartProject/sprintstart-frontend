import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuddyTypingMessage } from "../../../../src/features/buddy/components/BuddyMessage.tsx";

// The dino waiting-game as the buddy hosts it: its badge must say how the turn ended, and the
// game must not sit inside the typing indicator's live region.
describe("BuddyTypingMessage with the dino game", () => {
  it("labels a failed reply as failed, not ready", () => {
    render(<BuddyTypingMessage gameActive replyReady turnOutcome="failed" onGameExit={vi.fn()} />);
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent("Reply failed");
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveAttribute("data-tone", "danger");
  });

  it("says Reply ready when the reply arrived", () => {
    render(<BuddyTypingMessage gameActive replyReady turnOutcome="done" onGameExit={vi.fn()} />);
    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent("Reply ready");
  });

  it("keeps the running game out of any live region", () => {
    render(<BuddyTypingMessage gameActive onGameExit={vi.fn()} />);
    expect(screen.getByTestId("dino-game").closest('[role="status"]')).toBeNull();
    expect(screen.getByTestId("dino-game").closest("[aria-live]")).toBeNull();
  });
});
