import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BuddyDock } from "../../../../src/features/buddy/components/BuddyDock";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";
import type { BuddySuggestion } from "../../../../src/services/buddyService";

// Every question carries the escalation trigger now, and that reads the selected project.
vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "p1", name: "Project One" }),
      }),
  };
});

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
      activeTool={null}
      draft=""
      setDraft={setDraft}
      handleSubmit={vi.fn()}
      confirmAction={vi.fn()}
      dismissAction={vi.fn()}
      suggestions={suggestions}
      startFreshVisit={vi.fn()}
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
 * genuine "does it overflow at 400 px" test is not available here — but the regression they guard
 * against is not a subtle layout shift, it is somebody deleting `min-w-0` and `overflow-x-hidden`
 * because they read as noise. The class *is* the contract in a Tailwind codebase.
 */
describe("BuddyDock horizontal overflow", () => {
  it("never lets the conversation itself scroll sideways", () => {
    renderDock([assistant("hello")]);

    const transcript = screen.getByTestId("buddy-dock-transcript");
    // `overflow-y: auto` alone computes overflow-x to `auto` as well, which is what put a
    // horizontal scrollbar across the whole conversation. Vertical scrolling stays.
    expect(transcript).toHaveClass("overflow-x-hidden");
    expect(transcript).toHaveClass("overflow-y-auto");
  });

  it("lets a bubble shrink below its content so wide blocks scroll inside themselves", () => {
    renderDock([assistant("a reply")]);

    // The chain the fix has to be unbroken along: the markdown wrapper, then the bubble it
    // sits in. One `min-width: auto` anywhere between the dock and a `pre` is enough to
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
 * The window is 400 px wide and has the buddy's name in its own header, so a name over every
 * bubble would say it twice on a column that cannot spare the line. The page turns them on
 * (`showNames`) because there the header is far from the messages.
 */
describe("BuddyDock transcript", () => {
  it("renders both sides of the conversation", () => {
    renderDock([user("is my PR stuck?"), assistant("It has waited 52 hours.")]);

    expect(screen.getByText("is my PR stuck?")).toBeInTheDocument();
    expect(screen.getByText("It has waited 52 hours.")).toBeInTheDocument();
  });
});

/**
 * Escalating belongs to the question, not to the reply — a hire does not flag an answer, they
 * flag the thing they still need answered. The corner window could not escalate at all before
 * this; the offer lived only on the page, and only under the buddy's answer.
 */
describe("BuddyDock escalation", () => {
  it("offers to send any of the hire's own questions to their PM", () => {
    renderDock([user("how do I get staging credentials?")]);

    expect(screen.getByRole("button", { name: /Send this to your PM/ })).toBeInTheDocument();
  });

  it("offers nothing of the sort under the buddy's own replies", () => {
    renderDock([assistant("It has waited 52 hours.")]);

    expect(screen.queryByRole("button", { name: /Send this to your PM/ })).not.toBeInTheDocument();
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
