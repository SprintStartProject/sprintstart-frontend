import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuddyConversation } from "../../../../src/features/buddy/components/BuddyConversation";
import { BuddyDock } from "../../../../src/features/buddy/components/BuddyDock";
import {
  BuddyDraftActionsContext,
  BuddyDraftContext,
} from "../../../../src/features/buddy/buddyDraftContext";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";

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

const TURNS: BuddyMessageView[] = [
  { id: "m1", role: "USER", content: "is my PR stuck?", createdAt: "2026-07-22T00:00:00Z" },
  {
    id: "m2",
    role: "ASSISTANT",
    content: "It has waited 52 hours.",
    createdAt: "2026-07-22T00:00:01Z",
  },
];

/** jsdom does no layout, so the transcript gets a scrollable shape by hand. */
function giveScrollingShape(transcript: HTMLElement) {
  Object.defineProperty(transcript, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(transcript, "clientHeight", { value: 400, configurable: true });
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const draftStub = { draft: "", setDraft: vi.fn(), handleSubmit: vi.fn() };

describe("the way back to the newest message", () => {
  it("appears on the page only after the reader scrolls up, and takes them back", async () => {
    const user = userEvent.setup();
    render(
      <BuddyDraftContext.Provider value={draftStub}>
        <BuddyConversation
          messages={TURNS}
          isThinking={false}
          activeTool={null}
          confirmAction={vi.fn()}
          dismissAction={vi.fn()}
          actionDrafts={{}}
          setActionDraft={vi.fn()}
        />
      </BuddyDraftContext.Provider>,
    );

    const transcript = screen.getByTestId("buddy-transcript");
    // At the bottom — following the newest message — there is nothing to offer.
    expect(screen.queryByTestId("buddy-jump-to-latest")).not.toBeInTheDocument();

    giveScrollingShape(transcript);
    transcript.scrollTop = 0;
    fireEvent.scroll(transcript);

    const jump = await screen.findByTestId("buddy-jump-to-latest");
    await user.click(jump);

    // Back at the bottom, the offer withdraws again.
    expect(screen.queryByTestId("buddy-jump-to-latest")).not.toBeInTheDocument();
  });

  it("is offered in the dock too", async () => {
    render(
      <BuddyDraftActionsContext.Provider value={{ setDraft: vi.fn() }}>
        <BuddyDraftContext.Provider value={draftStub}>
          <BuddyDock
            messages={TURNS}
            isThinking={false}
            isStreaming={false}
            stopStreaming={vi.fn()}
            queued={[]}
            queuePaused={false}
            removeQueued={vi.fn()}
            pullQueuedMessage={vi.fn(() => null)}
            resumeQueue={vi.fn()}
            filters={{ sourceSystems: [], from: "", to: "" }}
            setFilters={vi.fn()}
            capabilitiesEnabled
            setCapabilitiesEnabled={vi.fn()}
            activeTool={null}
            confirmAction={vi.fn()}
            dismissAction={vi.fn()}
            actionDrafts={{}}
            setActionDraft={vi.fn()}
            suggestions={[]}
            newConversation={vi.fn()}
            isOpening={false}
            isGreeting={false}
            isDeciding={false}
            teamProjectId={null}
            retryReply={vi.fn()}
            onClose={vi.fn()}
          />
        </BuddyDraftContext.Provider>
      </BuddyDraftActionsContext.Provider>,
    );

    const transcript = screen.getByTestId("buddy-dock-transcript");
    expect(screen.queryByTestId("buddy-jump-to-latest")).not.toBeInTheDocument();

    giveScrollingShape(transcript);
    transcript.scrollTop = 0;
    fireEvent.scroll(transcript);

    expect(await screen.findByTestId("buddy-jump-to-latest")).toBeInTheDocument();
  });
});
