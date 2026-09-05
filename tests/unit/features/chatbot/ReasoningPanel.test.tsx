import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReasoningPanel } from "../../../../src/features/chatbot/components/ReasoningPanel";

/**
 * The panel's fold rules, driven the way a stream drives them: by re-rendering with longer
 * texts rather than by poking state.
 *
 * The third test is the one with history behind it. The model streams its tool-decision turn
 * now, so a turn that searches produces reasoning → a short preamble → the tool → *more*
 * reasoning → the answer. A panel that folded once and stayed folded hid the second half.
 */
describe("ReasoningPanel", () => {
  const toggle = () => screen.getByRole("button", { name: /Thought process/ });

  it("opens itself while the reasoning is the only thing arriving", () => {
    render(<ReasoningPanel reasoning="Working on it" isStreaming answerLength={0} />);

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("thinking…")).toBeInTheDocument();
  });

  it("renders a finished turn folded, because its reasoning is the working, not the result", () => {
    render(<ReasoningPanel reasoning="Worked on it" isStreaming={false} answerLength={12} />);

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("(hidden)")).toBeInTheDocument();
  });

  it("folds away when the answer starts", () => {
    const { rerender } = render(
      <ReasoningPanel reasoning="Working on it" isStreaming answerLength={0} />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    rerender(<ReasoningPanel reasoning="Working on it" isStreaming answerLength={7} />);

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("comes back when the model thinks again after a tool, and folds on the answer that follows", () => {
    // Planning.
    const { rerender } = render(
      <ReasoningPanel reasoning="They want the retro." isStreaming answerLength={0} />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    // The preamble — an answer token, but not the answer.
    rerender(<ReasoningPanel reasoning="They want the retro." isStreaming answerLength={14} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    // The tool came back and the model is thinking about what it got.
    rerender(
      <ReasoningPanel
        reasoning="They want the retro. The search found three blockers."
        isStreaming
        answerLength={14}
      />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("thinking…")).toBeInTheDocument();

    // The real answer.
    rerender(
      <ReasoningPanel
        reasoning="They want the retro. The search found three blockers."
        isStreaming
        answerLength={48}
      />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves the panel where the reader put it, in both directions", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReasoningPanel reasoning="Working on it" isStreaming answerLength={0} />,
    );

    // Opened by us, closed by the reader: the answer arriving must not re-fold it, and more
    // reasoning must not re-open it.
    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    rerender(<ReasoningPanel reasoning="Working on it" isStreaming answerLength={7} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    rerender(<ReasoningPanel reasoning="Working on it, still" isStreaming answerLength={7} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    // And the other way: opened by the reader mid-answer, it stays open.
    await user.click(toggle());
    rerender(<ReasoningPanel reasoning="Working on it, still" isStreaming answerLength={30} />);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("does not open a finished message that gets longer reasoning swapped into it", () => {
    const { rerender } = render(
      <ReasoningPanel reasoning="Worked on it" isStreaming={false} answerLength={12} />,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ReasoningPanel reasoning="Worked on it, at length" isStreaming={false} answerLength={12} />,
    );

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });
});
