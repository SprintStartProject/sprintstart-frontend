import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuddyTypingMessage } from "../../../../src/features/buddy/components/BuddyMessage.tsx";

// The dino waiting-game as the buddy hosts it: its badge must say how the turn ended, and the
// game must not sit inside the typing indicator's live region.
describe("BuddyTypingMessage with the dino game", () => {
  it("labels a failed reply as failed, not ready", async () => {
    render(<BuddyTypingMessage gameActive replyReady turnOutcome="failed" onGameExit={vi.fn()} />);
    // The game chunk arrives behind the shared Suspense boundary; await the mount.
    const badge = await screen.findByTestId("dino-game-reply-ready");
    expect(badge).toHaveTextContent("Reply failed");
    expect(badge).toHaveAttribute("data-tone", "danger");
  });

  it("labels a stopped turn as stopped, not ready", async () => {
    render(<BuddyTypingMessage gameActive replyReady turnOutcome="stopped" onGameExit={vi.fn()} />);
    const badge = await screen.findByTestId("dino-game-reply-ready");
    expect(badge).toHaveTextContent("Stopped");
    expect(badge).toHaveAttribute("data-tone", "neutral");
  });

  it("says Reply ready when the reply arrived", async () => {
    render(<BuddyTypingMessage gameActive replyReady turnOutcome="done" onGameExit={vi.fn()} />);
    expect(await screen.findByTestId("dino-game-reply-ready")).toHaveTextContent("Reply ready");
  });

  it("keeps the running game out of any live region", async () => {
    render(<BuddyTypingMessage gameActive onGameExit={vi.fn()} />);
    const game = await screen.findByTestId("dino-game");
    expect(game.closest('[role="status"]')).toBeNull();
    expect(game.closest("[aria-live]")).toBeNull();
  });
});
