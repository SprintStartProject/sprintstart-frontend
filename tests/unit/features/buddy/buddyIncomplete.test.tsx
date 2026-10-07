import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuddyConversation } from "../../../../src/features/buddy/components/BuddyConversation";
import { BuddyDraftContext } from "../../../../src/features/buddy/buddyDraftContext";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

/**
 * A reply that was cut short — the stream ended before the answer finished, and the backend
 * kept the words that had arrived — is still an answer, and the thread says why it ends where
 * it does. The flag only ever arrives with a history read; a live failure carries its own
 * `error` line instead (see `buddyFailures`).
 */

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1", canManageSelected: false }),
}));

vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

function renderConversation(messages: BuddyMessageView[]) {
  return render(
    <BuddyDraftContext.Provider value={{ draft: "", setDraft: vi.fn(), handleSubmit: vi.fn() }}>
      <BuddyConversation
        messages={messages}
        isThinking={false}
        activeTool={null}
        confirmAction={vi.fn()}
        dismissAction={vi.fn()}
        actionDrafts={{}}
        setActionDraft={vi.fn()}
        openError={null}
      />
    </BuddyDraftContext.Provider>,
  );
}

describe("a reply that was cut short", () => {
  it("says so, under the words that did arrive", () => {
    renderConversation([
      {
        id: "m1",
        role: "USER",
        content: "How do I set this up?",
        createdAt: "2026-10-01T09:00:00.000Z",
      },
      {
        id: "m2",
        role: "ASSISTANT",
        content: "First, install the",
        createdAt: "2026-10-01T09:00:01.000Z",
        isIncomplete: true,
      },
    ]);

    expect(screen.getByText("First, install the")).toBeInTheDocument();
    expect(screen.getByTestId("buddy-message-incomplete")).toHaveTextContent(
      "This reply was cut short.",
    );
  });

  it("is silent for a reply that finished", () => {
    renderConversation([
      {
        id: "m1",
        role: "ASSISTANT",
        content: "All done — you are set up.",
        createdAt: "2026-10-01T09:00:01.000Z",
      },
    ]);

    expect(screen.queryByTestId("buddy-message-incomplete")).not.toBeInTheDocument();
  });

  it("never lands on the hire's own turn, whatever the payload says", () => {
    renderConversation([
      {
        id: "m1",
        role: "USER",
        content: "How do I set this up?",
        createdAt: "2026-10-01T09:00:00.000Z",
        isIncomplete: true,
      },
    ]);

    expect(screen.queryByTestId("buddy-message-incomplete")).not.toBeInTheDocument();
  });
});

/**
 * A turn the hire stopped with the composer's Stop button. Usually it has no words at all — the
 * backend writes the whole agent loop before it emits one — and an empty assistant turn renders
 * as nothing, so without its own line the question sat there unanswered and unexplained.
 */
describe("a reply the hire stopped", () => {
  const question: BuddyMessageView = {
    id: "m1",
    role: "USER",
    content: "How do I set this up?",
    createdAt: "2026-10-01T09:00:00.000Z",
  };

  it("says so even when it was stopped before its first word", () => {
    renderConversation([
      question,
      {
        id: "m2",
        role: "ASSISTANT",
        content: "",
        createdAt: "2026-10-01T09:00:01.000Z",
        stopped: true,
      },
    ]);

    expect(screen.getByTestId("buddy-message-stopped")).toHaveTextContent(
      "You stopped this reply.",
    );
  });

  it("keeps what arrived above the line", () => {
    renderConversation([
      question,
      {
        id: "m2",
        role: "ASSISTANT",
        content: "First, install the",
        createdAt: "2026-10-01T09:00:01.000Z",
        stopped: true,
      },
    ]);

    expect(screen.getByText("First, install the")).toBeInTheDocument();
    expect(screen.getByTestId("buddy-message-stopped")).toBeInTheDocument();
    // One line, worded for what happened — not the backend's "cut short" beside it.
    expect(screen.queryByTestId("buddy-message-incomplete")).not.toBeInTheDocument();
  });

  it("still renders nothing for an empty turn that is merely waiting", () => {
    renderConversation([
      question,
      {
        id: "m2",
        role: "ASSISTANT",
        content: "",
        createdAt: "2026-10-01T09:00:01.000Z",
      },
    ]);

    expect(screen.queryByTestId("buddy-message-stopped")).not.toBeInTheDocument();
  });
});
