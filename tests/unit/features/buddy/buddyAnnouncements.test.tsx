import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuddyThread } from "../../../../src/features/buddy/components/BuddyThread";
import { BuddyComposer } from "../../../../src/features/buddy/components/BuddyComposer";
import { BuddyDraftContext } from "../../../../src/features/buddy/buddyDraftContext";
import type { BuddyMessageView, QueuedBuddyMessage } from "../../../../src/features/buddy/types";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

const QUESTION: BuddyMessageView = {
  id: "m1",
  role: "USER",
  content: "How do I deploy?",
  createdAt: "2026-10-01T09:00:00.000Z",
};

function reply(extra: Partial<BuddyMessageView> = {}): BuddyMessageView {
  return {
    id: "m2",
    role: "ASSISTANT",
    content: "Like this.",
    createdAt: "2026-10-01T09:00:01.000Z",
    ...extra,
  };
}

/** Renders the thread with `isThinking` flippable, so a turn can finish mid-test. */
function renderThread(
  messages: BuddyMessageView[],
  { busy, dinoGameActive = false }: { busy: boolean; dinoGameActive?: boolean },
) {
  const node = (nextBusy: boolean) => (
    <BuddyThread
      messages={messages}
      isThinking={nextBusy}
      isStreaming={false}
      activeTool={null}
      confirmAction={vi.fn()}
      dismissAction={vi.fn()}
      actionDrafts={{}}
      setActionDraft={vi.fn()}
      dinoGameActive={dinoGameActive}
      onDinoGameExit={vi.fn()}
    />
  );
  const view = render(node(busy));
  return { rerender: (nextBusy: boolean) => view.rerender(node(nextBusy)) };
}

/**
 * The thread's own status voice, and the composer's — the two completions that had no
 * announcement: a finished turn (the retired chat said "Response complete") and a queued
 * message. Both are sr-only live regions; the assertions read the text they hold.
 */
describe("the buddy surface's announcements", () => {
  it("announces a finished turn once the buddy stops working", () => {
    const { rerender } = renderThread([QUESTION, reply()], { busy: true });
    expect(screen.queryByText("Response complete")).not.toBeInTheDocument();

    rerender(false);
    expect(screen.getByText("Response complete")).toBeInTheDocument();
  });

  it("announces a failed reply as failed, not as complete", () => {
    const { rerender } = renderThread([QUESTION, reply({ error: "It broke." })], { busy: true });

    rerender(false);
    expect(screen.getByText("Reply failed")).toBeInTheDocument();
    expect(screen.queryByText("Response complete")).not.toBeInTheDocument();
  });

  it("announces a stopped reply as stopped", () => {
    const { rerender } = renderThread([QUESTION, reply({ stopped: true })], { busy: true });

    rerender(false);
    expect(screen.getByText("Reply stopped")).toBeInTheDocument();
  });

  /** The game announces its own outcome while it is open; two voices would be noise. */
  it("stays silent while the dino game is open", () => {
    const { rerender } = renderThread([QUESTION, reply()], { busy: true, dinoGameActive: true });

    rerender(false);
    expect(screen.queryByText("Response complete")).not.toBeInTheDocument();
  });

  it("announces a queued message, and clears so the next one can speak", () => {
    const queue = (items: QueuedBuddyMessage[]) => ({
      items,
      paused: false,
      onRemove: vi.fn(),
      onPull: vi.fn(() => null),
      onSendQueued: vi.fn(),
    });
    const node = (items: QueuedBuddyMessage[]) => (
      <BuddyDraftContext.Provider value={{ draft: "", setDraft: vi.fn(), handleSubmit: vi.fn() }}>
        <BuddyComposer queue={queue(items)} />
      </BuddyDraftContext.Provider>
    );

    const view = render(node([]));
    expect(screen.queryByText("Message queued")).not.toBeInTheDocument();

    view.rerender(node([{ id: "q1", text: "later" }]));
    expect(screen.getByText("Message queued")).toBeInTheDocument();

    view.rerender(node([]));
    expect(screen.queryByText("Message queued")).not.toBeInTheDocument();
  });
});
