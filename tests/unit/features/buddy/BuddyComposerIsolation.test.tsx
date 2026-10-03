import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { BuddyPage } from "../../../../src/pages/BuddyPage";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { BuddyMarkdown } from "../../../../src/features/buddy/components/BuddyMarkdown";
import { BuddyWidget } from "../../../../src/features/buddy/components/BuddyWidget";
import type { BuddyMessage, BuddyStreamHandlers } from "../../../../src/features/buddy/types";
import { getMessages, streamMessage } from "../../../../src/services/buddyService";
import { BuddyTestProviders, createProjectValue } from "./buddyTestHarness";

/**
 * Issue #236, pinned: a keystroke in the composer must cost one render of one box — never a
 * re-parse of the conversation behind it.
 *
 * The regression this guards is not visible to any other test in the suite: every buddy test
 * asserts what a *single* surface shows, and the lag lived in the wiring between them. Here the
 * page is mounted with a long transcript under the real provider, and the number of times a reply
 * is parsed is counted — zero for a keystroke, one per streamed token for the single reply
 * receiving them.
 */
vi.mock("../../../../src/features/buddy/components/BuddyMarkdown", () => ({
  // Counted rather than rendered: how many *times* a reply is parsed is the subject here, and a
  // stub that keeps the count answers it directly. What the renderer draws has its own tests.
  BuddyMarkdown: vi.fn(({ content }: { content: string }) => <div>{content}</div>),
}));

vi.mock("../../../../src/services/buddyService", () => ({
  getMessages: vi.fn(),
  // One conversation, read once — its id rides on every request the page makes.
  getSessions: vi
    .fn()
    .mockResolvedValue([
      { id: "session-1", title: "", projectId: null, createdAt: "2026-09-30T09:00:00Z" },
    ]),
  createSession: vi.fn().mockResolvedValue("session-2"),
  // The conversation has history, so nothing greets — see `ensureOpened`.
  streamOpenBuddy: vi.fn(() => Promise.resolve()),
  streamMessage: vi.fn(),
  performAction: vi.fn(),
  getSuggestions: vi.fn().mockResolvedValue([]),
}));

const { floatingRenders } = vi.hoisted(() => ({ floatingRenders: { count: 0 } }));

vi.mock("../../../../src/features/buddy/buddyCorner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/features/buddy/buddyCorner")>()),
  // Counts the renders of everything that floats: the widget, the dock and the launcher are the
  // three components that ask how big the window is. A keystroke must reach none of them, and
  // nothing else in this file mounts them.
  useViewportSize: () => {
    floatingRenders.count += 1;
    return { width: 1280, height: 800 };
  },
}));

/** Sixteen questions and sixteen replies — the "20–50 messages" case from the issue. */
const LONG_CONVERSATION: BuddyMessage[] = Array.from({ length: 32 }, (_, index) =>
  index % 2 === 0
    ? { role: "USER", content: `Question ${index / 2}`, createdAt: "2026-08-03T00:00:00Z" }
    : {
        role: "ASSISTANT",
        content: `Reply **${(index - 1) / 2}**\n\n- first\n- second`,
        createdAt: "2026-08-03T00:00:00Z",
      },
);

const markdown = vi.mocked(BuddyMarkdown);

/** What the hook handed the streaming service, so a test can drive one token at a time. */
let streamHandlers: BuddyStreamHandlers | null = null;
let finishStream: (() => void) | null = null;

/** The long conversation is already there, and the next send is held open for tokens. */
function stubLongConversation() {
  markdown.mockClear();
  streamHandlers = null;
  finishStream = null;
  vi.mocked(getMessages).mockResolvedValue(LONG_CONVERSATION);
  vi.mocked(streamMessage).mockImplementation((_content, handlers) => {
    streamHandlers = handlers;
    // Held open until the test says so, so a token can be driven deliberately.
    return new Promise<void>((resolve) => {
      finishStream = resolve;
    });
  });
}

function renderPage() {
  return render(
    <BuddyTestProviders
      projectValue={createProjectValue({ selectedProjectId: "p1", hasSelectedProject: true })}
    >
      <MemoryRouter initialEntries={["/buddy"]}>
        <BuddyProvider>
          <BuddyPage />
        </BuddyProvider>
      </MemoryRouter>
    </BuddyTestProviders>,
  );
}

describe("the composer in a long conversation", () => {
  beforeEach(stubLongConversation);

  it("does not re-parse the conversation while the hire types", async () => {
    const user = userEvent.setup();
    renderPage();

    // The whole thread is on screen first: sixteen replies, each parsed exactly once.
    await screen.findByText(/Reply \*\*15\*\*/);
    expect(markdown.mock.calls.length).toBeGreaterThanOrEqual(16);

    markdown.mockClear();

    await user.type(screen.getByLabelText("Message"), "why is this slow?");

    // Every one of those replies stayed exactly as it was — the whole of #236 in one assertion.
    expect(markdown).not.toHaveBeenCalled();
  });

  it("sends what was typed, and re-parses only the reply that is streaming", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Reply \*\*15\*\*/);

    const field = screen.getByLabelText("Message");
    await user.type(field, "what is left?");
    markdown.mockClear();
    await user.click(screen.getByRole("button", { name: "Send message" }));

    // The box gave up its words, and the turn is the hook's now.
    expect(field).toHaveValue("");
    await waitFor(() => expect(vi.mocked(streamMessage)).toHaveBeenCalled());
    expect(vi.mocked(streamMessage).mock.calls[0][0]).toBe("what is left?");
    expect(streamHandlers).not.toBeNull();

    // A send is one honest re-render of the conversation — a row joins it, and the fresh-visit
    // control withdraws while the turn is in flight — so the count is reset *after* it. What
    // follows is the real subject: each token belongs to one reply and must cost one parse.
    markdown.mockClear();

    act(() => {
      streamHandlers?.onToken(" first");
    });
    expect(markdown).toHaveBeenCalledTimes(1);

    act(() => {
      streamHandlers?.onToken(" second");
    });
    expect(markdown).toHaveBeenCalledTimes(2);

    act(() => {
      streamHandlers?.onDone();
      finishStream?.();
    });

    // The turn lands: what the tokens built is on screen, and no assertion above needed it to.
    await screen.findByText(/first\s*second/);
  });
});

/**
 * The other half of #236: the floating window.
 *
 * The issue is about the buddy, not about `/buddy` — and the widget is the surface that is always
 * mounted, on every page and on `/buddy` too (where it renders nothing). It read the draft through
 * `useBuddy()`, which put a keystroke in the dock — and a keystroke on the page — back into the
 * widget's render path, taking the dock and every reply in it along for the ride.
 */
describe("the buddy's floating window", () => {
  beforeEach(() => {
    stubLongConversation();
    floatingRenders.count = 0;
  });

  function renderFloating(node: ReactNode, route = "/board") {
    return render(
      <BuddyTestProviders
        projectValue={createProjectValue({ selectedProjectId: "p1", hasSelectedProject: true })}
      >
        <MemoryRouter initialEntries={[route]}>
          <BuddyProvider>{node}</BuddyProvider>
        </MemoryRouter>
      </BuddyTestProviders>,
    );
  }

  it("does not re-render — or re-parse anything — for a keystroke in the dock", async () => {
    const user = userEvent.setup();
    renderFloating(<BuddyWidget />);

    // Open it and let the conversation arrive: this is the screen a hire types on.
    await user.click(await screen.findByLabelText("Open buddy chat"));
    const field = await screen.findByLabelText("Message");
    await waitFor(() => expect(vi.mocked(getMessages)).toHaveBeenCalled());
    // The call is not the arrival: the history lands a few ticks later and re-renders the widget
    // once, which on a slow runner falls inside the typing below and reads as a keystroke.
    await screen.findByText(/Reply \*\*15\*\*/);

    markdown.mockClear();
    const before = floatingRenders.count;
    // The count is wired before it is trusted: a spy that never fires would pass vacuously.
    expect(before).toBeGreaterThan(0);

    await user.type(field, "why is this slow?");

    expect(markdown).not.toHaveBeenCalled();
    expect(floatingRenders.count).toBe(before);
  });

  it("does not re-render while the hire types on /buddy either", async () => {
    const user = userEvent.setup();
    renderFloating(
      <>
        <BuddyWidget />
        <BuddyPage />
      </>,
      "/buddy",
    );

    await screen.findByText(/Reply \*\*15\*\*/);
    const before = floatingRenders.count;
    expect(before).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Message"), "why is this slow?");

    expect(floatingRenders.count).toBe(before);
  });
});
