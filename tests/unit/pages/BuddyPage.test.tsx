import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BuddyPage } from "../../../src/pages/BuddyPage";
import { BuddyProvider } from "../../../src/features/buddy/BuddyProvider";

const projectState = { selectedProjectId: "p1" };

vi.mock("../../../src/services/buddyService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  streamOpenBuddy: vi.fn((handlers: { onToken: (token: string) => void; onDone: () => void }) => {
    handlers.onToken("Welcome back!");
    handlers.onDone();
    return Promise.resolve();
  }),
  streamMessage: vi.fn(),
  performAction: vi.fn(),
  // The chips are the backend's now, gated on the tools mounted for this hire — the page no
  // longer holds a list of its own, which is what let "Is my PR stuck?" reach every role.
  getSuggestions: vi
    .fn()
    .mockResolvedValue([
      { label: "What should I work on?", question: "What should I work on next?" },
    ]),
}));

vi.mock("../../../src/services/onboardingMetricsService", () => ({
  onboardingMetricsService: {
    fetchMyTimeline: vi.fn().mockRejectedValue(new Error("no metrics")),
  },
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: projectState.selectedProjectId,
        projects: projectState.selectedProjectId
          ? [createSelectableProject({ id: "p1", name: "Project One" })]
          : [],
        selectedProject: projectState.selectedProjectId
          ? createSelectableProject({ id: "p1", name: "Project One" })
          : null,
      }),
  };
});

import { getMessages, streamOpenBuddy, streamMessage } from "../../../src/services/buddyService";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/buddy"]}>
      {/* The conversation belongs to the provider, not to the page — the page is one of two
                views of it. Rendering the page without one is not a supported arrangement, and
                `useBuddySession` says so rather than quietly making a second conversation. */}
      <BuddyProvider>
        <BuddyPage />
      </BuddyProvider>
    </MemoryRouter>,
  );
}

describe("BuddyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    projectState.selectedProjectId = "p1";
    // `clearAllMocks` drops the module mock's resolved values too, so the default — an empty
    // visit, the case that greets — has to be restored per test.
    vi.mocked(getMessages).mockResolvedValue([]);
  });

  it("shows the no-project state when the hire is not on a project yet", async () => {
    projectState.selectedProjectId = "";

    renderPage();

    expect(await screen.findByText(/not on a project yet/)).toBeInTheDocument();
    // Nothing is opened for somebody with nowhere to onboard.
    expect(streamOpenBuddy).not.toHaveBeenCalled();
  });

  /**
   * The bug this replaced: the page opened a visit unconditionally. Opening is idempotent only
   * while the hire has said nothing — once they have, a second open rotates the visit
   * server-side, folding what was said into memory and starting a new window. So asking
   * something in the dock and then opening the full page really did destroy the context, and
   * the hire was shown a greeting where their conversation had been.
   */
  it("shows the conversation already in progress instead of opening a new visit", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
      {
        role: "ASSISTANT",
        content: "With the setup guide.",
        createdAt: "2026-08-24T10:00:01.000Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("where do I start?")).toBeInTheDocument();
    expect(screen.getByText("With the setup guide.")).toBeInTheDocument();
    // No greeting, and — the part that matters — no model call that would have rotated the visit.
    expect(streamOpenBuddy).not.toHaveBeenCalled();
  });

  /**
   * A visit ends when the hire speaks, so asking the backend to open again writes a fresh
   * opening marker and the scrollback starts from there. That is all "New chat" is — there is
   * no reset endpoint and none is needed. Nothing is deleted: the transcript stays in
   * `buddy_messages` and the buddy's durable memory note, which the next greeting is written
   * from, is untouched.
   */
  it("starts a fresh visit without losing what the buddy has learned", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
      {
        role: "ASSISTANT",
        content: "With the setup guide.",
        createdAt: "2026-08-24T10:00:01.000Z",
      },
    ]);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /New chat/ }));

    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });
    // The greeting is re-requested, which is what opens the new visit server-side.
    expect(streamOpenBuddy).toHaveBeenCalled();
  });

  it("opens the mentor for a hire on a project", async () => {
    renderPage();

    expect(await screen.findByText("What should I work on?")).toBeInTheDocument();
    expect(streamOpenBuddy).toHaveBeenCalled();
  });

  /**
   * A chip fills the composer; it does not send. Calling `sendMessage` directly would
   * make the first thing the mentor ever hears from a hire words the page chose. The hire
   * presses send — and can edit the question first, which is how somebody discovers they are
   * allowed to.
   */
  it("fills the composer from a chip instead of sending it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "What should I work on?" }));

    expect(screen.getByPlaceholderText("Ask your buddy anything...")).toHaveValue(
      "What should I work on next?",
    );
    expect(streamMessage).not.toHaveBeenCalled();
  });

  /**
   * The greeting costs a model call, and the page used to blank itself behind a spinner
   * until it landed — about 20 seconds on a real corpus, on the hire's own landing page.
   *
   * Nothing on the page needs the greeting in order to work, so nothing waits for it. This is
   * the rule the board already holds itself to: a page that waits on a model to open is a page
   * nobody opens.
   */
  /**
   * The greeting used to arrive whole, after the model had first written a private memory note
   * of up to 200 words that the hire never sees — about 30 seconds of nothing on their own
   * landing page. It is written first now and streamed, so the wait ends at the first word.
   */
  it("grows the greeting in place as it streams, rather than one message per token", async () => {
    vi.mocked(streamOpenBuddy).mockImplementation((handlers) => {
      handlers.onToken("Welcome back, ");
      handlers.onToken("Sam!");
      handlers.onDone();
      return Promise.resolve();
    });

    renderPage();

    expect(await screen.findByText("Welcome back, Sam!")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back,")).not.toBeInTheDocument();
  });

  /**
   * The page stops waiting at the first word, not the last: everything after that is the hire
   * reading along, and the composer is theirs from there.
   */
  it("stops waiting on the first token, not the last", async () => {
    // A greeting that starts and never finishes -- the page must already be usable.
    vi.mocked(streamOpenBuddy).mockImplementation(
      (handlers) =>
        new Promise(() => {
          handlers.onToken("Welcome");
        }),
    );

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Welcome")).toBeInTheDocument();
    const composer = await screen.findByPlaceholderText("Ask your buddy anything...");
    await user.type(composer, "where do I start?");

    expect(composer).toHaveValue("where do I start?");
  });

  it("offers the suggested next step the opener carried", async () => {
    vi.mocked(streamOpenBuddy).mockImplementation((handlers) => {
      handlers.onToken("Hi!");
      handlers.onAction?.({ label: "Find me a task", question: "What should I work on?" });
      handlers.onDone();
      return Promise.resolve();
    });

    renderPage();

    expect(await screen.findByText("Find me a task")).toBeInTheDocument();
  });

  /**
   * Closing a conversation should put you back where you were, not on a page you never chose.
   * `location.key` is `"default"` only on the entry the app was loaded at — a hard reload onto
   * `/buddy`, or a link from outside — where stepping back would leave the app entirely. The
   * board is where a hire belongs instead, and it is the durable half of this same conversation.
   */
  it("falls back to the board when there is no history to close back into", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/buddy"]}>
        <BuddyProvider>
          <Routes>
            <Route path="/buddy" element={<BuddyPage />} />
            <Route path="/board" element={<p>the board</p>} />
          </Routes>
        </BuddyProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Close the conversation" }));

    expect(await screen.findByText("the board")).toBeInTheDocument();
  });

  it("lets the hire type before the greeting has arrived", async () => {
    // A greeting that never arrives: the page must be usable regardless.
    vi.mocked(streamOpenBuddy).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderPage();

    const composer = await screen.findByPlaceholderText("Ask your buddy anything...");
    await user.type(composer, "where do I start?");

    expect(composer).toHaveValue("where do I start?");
  });
});
