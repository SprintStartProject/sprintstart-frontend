import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { BuddyDock } from "../../../../src/features/buddy/components/BuddyDock";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";
import type { BuddySuggestion } from "../../../../src/services/buddyService";

function renderDock(
  messages: BuddyMessageView[] = [],
  {
    suggestions = [],
    setDraft = vi.fn(),
  }: { suggestions?: BuddySuggestion[]; setDraft?: () => void } = {},
) {
  return render(
    <BuddyDock
      messages={messages}
      isThinking={false}
      draft=""
      setDraft={setDraft}
      handleSubmit={vi.fn()}
      confirmAction={vi.fn()}
      dismissAction={vi.fn()}
      bottomRef={createRef<HTMLDivElement>()}
      suggestions={suggestions}
      isOpen
      onClose={vi.fn()}
    />,
  );
}

const assistant = (content: string): BuddyMessageView => ({
  id: "a1",
  role: "ASSISTANT",
  content,
  createdAt: "2026-08-03T00:00:00Z",
});

const user = (content: string): BuddyMessageView => ({
  id: "u1",
  role: "USER",
  content,
  createdAt: "2026-08-03T00:00:00Z",
});

/**
 * These assert classes, not layout, and that is deliberate. jsdom computes no layout, so a
 * genuine "does it overflow at 27rem" test is not available here — but the regression they guard
 * against is not a subtle layout shift, it is somebody deleting `min-w-0` because it reads as
 * noise. The class *is* the contract in a Tailwind codebase.
 *
 * The dock no longer needs its own `overflow-x-hidden`: `ui/SidePanel`'s own root carries
 * `overflow-hidden`, so the panel cannot grow a sideways scrollbar. What is still ours is the
 * `min-w-0` chain — without it a grid item refuses to shrink below its content, the turn widens
 * to fit a wide code block, and `BuddyMarkdown`'s per-block scrollers never engage.
 */
describe("BuddyDock horizontal overflow", () => {
  it("lets a reply shrink below its content so wide blocks scroll inside themselves", () => {
    renderDock([assistant("a reply")]);

    // The chain the fix has to be unbroken along: the markdown wrapper, then the column it
    // sits in. One `min-width: auto` anywhere between the panel and a `pre` is enough to
    // widen everything above it.
    const markdown = screen.getByText("a reply").closest("div");
    expect(markdown).toHaveClass("min-w-0");
    expect(markdown?.parentElement).toHaveClass("min-w-0");
  });

  /** A URL is one unbreakable word to the line breaker; no container width fixes that. */
  it("breaks a long unbreakable token in the hire's own message", () => {
    const url =
      "https://github.com/SprintStartProject/sprintstart-backend/pull/152/files#diff-abcdef0123456789";
    renderDock([user(url)]);

    expect(screen.getByText(url)).toHaveClass("break-words");
  });
});

/**
 * Both speakers are named and both start at the same left margin. Opposing bubbles were the
 * one thing that made this read as a phone messenger rather than as part of the app, and the
 * name is also what a screen reader has to go on — which side of a panel something sits on is
 * not information it can convey.
 */
describe("BuddyDock transcript", () => {
  it("attributes every turn by name rather than by which side it sits on", () => {
    renderDock([user("is my PR stuck?"), assistant("It has waited 52 hours.")]);

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Buddy")).toBeInTheDocument();
  });
});

/**
 * The tutor's sharpest note was that the actions are unreachable unless you already know the
 * vocabulary — *"wenn der User einen Befehl nicht weiß oder nicht mal weiß, dass es überhaupt über
 * den Chat geht"*. The chips answer that, next to the composer they fill.
 */
describe("BuddyDock suggestion chips", () => {
  const suggestions: BuddySuggestion[] = [
    { label: "What should I work on?", question: "What should I work on next?" },
  ];

  /**
   * Fills, never sends. The hire presses send, so the question stays theirs and they can
   * edit it first. `handleSubmit` is the only thing that sends, and a chip must not reach it —
   * a control that speaks for somebody is a control they stop trusting.
   */
  it("puts the question in the composer without sending it", async () => {
    const setDraft = vi.fn();
    renderDock([], { suggestions, setDraft });

    await userEvent.click(screen.getByRole("button", { name: "What should I work on?" }));

    expect(setDraft).toHaveBeenCalledWith("What should I work on next?");
  });

  /** Once the hire has typed something they know how; the dock is narrow and the room is
   *  better spent on the conversation. */
  it("steps aside once the hire has said something", () => {
    renderDock([user("what should I do?")], { suggestions });

    expect(screen.queryByTestId("buddy-suggestions")).not.toBeInTheDocument();
  });

  /**
   * Nothing mounted for this hire means no chips — not an empty row with a heading over it. The
   * list is the backend's, gated on the tools it actually mounts, so "none" is a real answer.
   */
  it("renders nothing at all when the hire has no suggestions", () => {
    renderDock([], { suggestions: [] });

    expect(screen.queryByTestId("buddy-suggestions")).not.toBeInTheDocument();
    expect(screen.queryByText("Try asking")).not.toBeInTheDocument();
  });
});
