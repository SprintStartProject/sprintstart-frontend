import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuddyConversation } from "../../../../src/features/buddy/components/BuddyConversation";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

function renderConversation(overrides: {
  messages?: BuddyMessageView[];
  isThinking?: boolean;
  activeTool?: string | null;
}) {
  return render(
    <BuddyConversation
      messages={overrides.messages ?? []}
      isThinking={overrides.isThinking ?? false}
      activeTool={overrides.activeTool ?? null}
      draft=""
      setDraft={vi.fn()}
      handleSubmit={vi.fn()}
      confirmAction={vi.fn()}
      dismissAction={vi.fn()}
    />,
  );
}

describe("BuddyConversation", () => {
  it("renders the conversation turns", () => {
    renderConversation({
      messages: [
        { id: "1", role: "USER", content: "is my PR stuck?", createdAt: "2026-07-22T00:00:00Z" },
        {
          id: "2",
          role: "ASSISTANT",
          content: "It has waited 52 hours.",
          createdAt: "2026-07-22T00:00:01Z",
        },
      ],
    });

    expect(screen.getByText("is my PR stuck?")).toBeInTheDocument();
    expect(screen.getByText("It has waited 52 hours.")).toBeInTheDocument();
  });

  it("shows what the buddy is doing while a tool runs, not a bare spinner", () => {
    renderConversation({ isThinking: true, activeTool: "get_my_metrics" });

    expect(screen.getByText("Checking your progress…")).toBeInTheDocument();
  });

  it("always offers a way to send a message", () => {
    renderConversation({});

    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  /**
   * The same overflow fix as the floating panel, because this is the same bubble markup copied.
   * It is worth pinning *here* rather than only there: this page is wide, so an overflowing
   * reply reads as a slightly odd layout instead of an obvious bug — which is how a regression
   * would survive review. See `BuddyThread` for why `min-w-0` is what makes the per-block
   * scrollers work at all.
   */
  it("keeps a wide reply inside its bubble rather than widening the thread", () => {
    renderConversation({
      messages: [
        { id: "1", role: "ASSISTANT", content: "a reply", createdAt: "2026-08-03T00:00:00Z" },
      ],
    });

    const markdown = screen.getByText("a reply").closest("div");
    expect(markdown).toHaveClass("min-w-0");
    expect(markdown?.parentElement).toHaveClass("break-words");
  });
});
