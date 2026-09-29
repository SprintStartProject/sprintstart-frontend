import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThinkingIndicator } from "../../../../../src/features/chatbot/components/ThinkingIndicator";

// Mock DinoGame to inspect props and interactions
vi.mock("../../../../../src/features/chatbot/components/DinoGame", () => ({
  DinoGame: ({ onExit, replyReady }: { onExit: () => void; replyReady?: boolean }) => (
    <div data-testid="dino-game" data-reply-ready={String(Boolean(replyReady))}>
      <button onClick={onExit}>Exit Game</button>
    </div>
  ),
}));

describe("ThinkingIndicator", () => {
  it("renders null when not thinking and game is not active", () => {
    const { container } = render(
      <ThinkingIndicator
        isThinking={false}
        gameActive={false}
        thinkingState={null}
        onGameExit={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders bouncing dots when thinking and game is not active without reasoning", () => {
    render(
      <ThinkingIndicator
        isThinking={true}
        gameActive={false}
        thinkingState={null}
        hasReasoning={false}
        onGameExit={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
  });

  it("suppresses bouncing dots when thoughts/reasoning are streaming and game is not active", () => {
    const { container } = render(
      <ThinkingIndicator
        isThinking={true}
        gameActive={false}
        thinkingState={null}
        hasReasoning={true}
        onGameExit={vi.fn()}
      />,
    );

    // Suppressed so ReasoningPanel shows thoughts without a redundant bouncing dots avatar
    expect(container.firstChild).toBeNull();
  });

  it("renders DinoGame when game is active even if thoughts/reasoning are streaming", () => {
    render(
      <ThinkingIndicator
        isThinking={true}
        gameActive={true}
        thinkingState={null}
        hasReasoning={true}
        onGameExit={vi.fn()}
      />,
    );

    expect(screen.getByTestId("dino-game")).toBeInTheDocument();
    expect(screen.getByTestId("dino-game")).toHaveAttribute("data-reply-ready", "false");
  });

  it("keeps DinoGame active with replyReady when reply arrives (isThinking flips to false)", () => {
    const onExit = vi.fn();
    render(
      <ThinkingIndicator
        isThinking={false}
        gameActive={true}
        thinkingState={null}
        hasReasoning={false}
        replyReady={true}
        onGameExit={onExit}
      />,
    );

    expect(screen.getByTestId("dino-game")).toBeInTheDocument();
    expect(screen.getByTestId("dino-game")).toHaveAttribute("data-reply-ready", "true");

    fireEvent.click(screen.getByText("Exit Game"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("keeps the game out of the live region and announces only a concise status", () => {
    render(
      <ThinkingIndicator
        isThinking={true}
        gameActive={true}
        thinkingState={null}
        onGameExit={vi.fn()}
      />,
    );

    const status = screen.getByTestId("thinking-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("Thinking…");
    expect(status).not.toContainElement(screen.getByTestId("dino-game"));
    expect(screen.getByTestId("dino-game").closest('[role="status"]')).toBeNull();
  });
});
