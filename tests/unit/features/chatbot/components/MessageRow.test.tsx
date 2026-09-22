import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageRow } from "../../../../../src/features/chatbot/components/MessageRow";
import type { ChatMessage } from "../../../../../src/features/chatbot/types";

// A turn with content renders the "keep this chat" control, which reads the
// project selection; only the empty/notice turns below are about MessageRow
// itself, so the context is stubbed rather than mounted.
vi.mock("../../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});

/**
 * Renders one assistant turn.
 *
 * The three endings an assistant bubble can have — stopped, interrupted, failed —
 * are what this file is about, so the props that do not matter to them are fixed
 * here rather than repeated in every case.
 */
function renderAssistant(message: Partial<ChatMessage>, isThinking = false) {
  return render(
    <MessageRow
      message={{ id: "a1", role: "ASSISTANT", content: "", ...message } as ChatMessage}
      showDivider={false}
      isThinking={isThinking}
      isStreaming={false}
      streamingMessageId={null}
      profileFallbackName="Test User"
      onCitationClick={vi.fn()}
      onOpenArtifact={vi.fn()}
    />,
  );
}

describe("MessageRow notices", () => {
  it("explains a turn the user stopped, in place of the empty bubble", () => {
    renderAssistant({ notice: "stopped" });

    expect(screen.getByTestId("chat-message-notice")).toBeInTheDocument();
    expect(screen.getByText("Stopped before the assistant replied.")).toBeInTheDocument();
  });

  it("explains a turn that another chat's message interrupted", () => {
    renderAssistant({ notice: "interrupted" });

    expect(screen.getByText("Interrupted by a new message.")).toBeInTheDocument();
  });

  it("renders nothing at all for a failed turn with no answer", () => {
    // Failures are toasts now: the thread keeps whatever arrived, and a turn that
    // produced nothing leaves no stray pill or banner behind.
    const { container } = renderAssistant({});

    expect(screen.queryByTestId("chat-message-notice")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  it("keeps the partial answer of a failed turn and adds no notice to it", () => {
    renderAssistant({ content: "Half an answer" });

    expect(screen.getByText(/Half an answer/)).toBeInTheDocument();
    expect(screen.queryByTestId("chat-message-notice")).not.toBeInTheDocument();
  });

  it("still hides the empty placeholder while the assistant is thinking", () => {
    const { container } = renderAssistant({}, true);

    expect(container).toBeEmptyDOMElement();
  });
});
