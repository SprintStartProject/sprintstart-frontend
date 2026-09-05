import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BuddyPage } from "../../../src/pages/BuddyPage";
import { BuddyProvider } from "../../../src/features/buddy/BuddyProvider";
import { AssistantShell } from "../../../src/components/layout/AssistantShell";
import { mockResizableViewport } from "../setup/matchMedia";

const projectState = { selectedProjectId: "p1" };

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

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

vi.mock("../../../src/features/buddy/hooks/usePmReplies", () => ({
  usePmReplies: () => ({
    answered: [
      {
        id: "r1",
        projectId: "p1",
        hireId: "h1",
        question: "How do I get staging credentials?",
        status: "ANSWERED",
        createdAt: "2026-08-24T09:00:00Z",
        answeredAt: "2026-08-24T10:00:00Z",
        answer: {
          id: "a1",
          projectId: "p1",
          question: "How do I get staging credentials?",
          answer: "Ask in #platform.",
          authorId: "pm1",
          createdAt: "2026-08-24T10:00:00Z",
          updatedAt: "2026-08-24T10:00:00Z",
        },
      },
    ],
    waiting: [],
    dismissed: [],
    hasAny: true,
  }),
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
                `useBuddySession` says so rather than quietly making a second conversation.

                Under `AssistantShell`, because that is the arrangement the app runs: the page
                is a panel inside a layout route that owns the header, the switch between the
                two assistants, and "New chat". Testing the page bare would leave the controls
                it depends on untested from either side. */}
      <BuddyProvider>
        <Routes>
          <Route element={<AssistantShell />}>
            <Route path="/buddy" element={<BuddyPage />} />
          </Route>
        </Routes>
      </BuddyProvider>
    </MemoryRouter>,
  );
}

/**
 * Reports a viewport at or above `md`, where the rail is a column beside the conversation
 * rather than a drawer over it.
 *
 * jsdom answers `false` to every media query, so a test that means "on a desktop" is otherwise
 * quietly running on a phone — and the rail's remembered state is deliberately a desktop-only
 * thing, so that is the difference between asserting the behaviour and asserting its opposite.
 * Returns the undo, because the override outlives the test that set it.
 */
function reportDesktopViewport(): () => void {
  const original = window.matchMedia;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  return () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: original,
    });
  };
}

describe("BuddyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The rail's collapsed state is remembered per browser, so one test's choice would
    // otherwise decide the next one's starting layout.
    window.localStorage.clear();
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
   * The bug this replaced: the page opened a visit unconditionally, before reading anything. A
   * visit ends when the hire speaks, so a later open writes a new opening marker and the
   * message window starts from there — asking something in the dock and then opening the full
   * page showed a greeting where the conversation had been.
   *
   * Reading first is the fix; *not* opening at all would have been a different bug, since the
   * greeting is the only thing that reads the buddy's durable memory. So both, in order.
   */
  it("keeps the conversation on screen when the new visit opens under it", async () => {
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
    // The greeting arrives under it, and says so.
    expect(await screen.findByText("Welcome back!")).toBeInTheDocument();
    expect(screen.getByText("New conversation")).toBeInTheDocument();
  });

  /**
   * A visit ends when the hire speaks, so asking the backend to open again writes a fresh
   * opening marker and the scrollback starts from there. That is all "New chat" is — there is
   * no reset endpoint and none is needed. Nothing is deleted: the transcript stays in
   * `buddy_messages` and the buddy's durable memory note, which the next greeting is written
   * from, is untouched.
   */
  it("starts a fresh visit from the divider, without losing what the buddy has learned", async () => {
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

    // The control lives on the line that already says "everything above here is the last
    // conversation", so it only exists once there is such a line.
    await user.click(await screen.findByTestId("buddy-clear-previous"));

    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });
    // The greeting is re-requested, which is what opens the new visit server-side.
    expect(streamOpenBuddy).toHaveBeenCalled();
  });

  /**
   * `Alt+N` rather than `Ctrl+N`, which every desktop browser owns. It fires while the composer
   * has focus on purpose — halfway through typing into the wrong conversation is exactly when
   * somebody reaches for it.
   */
  it("starts a fresh visit on Alt+N", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
    ]);

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("where do I start?")).toBeInTheDocument();

    await user.keyboard("{Alt>}n{/Alt}");

    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });
  });

  /**
   * The chord belongs to whichever half is on screen, and while the panel slides *both* are
   * mounted — `AssistantShell` keeps the page being left there for the length of the animation,
   * and this listener is on `window`. Without the gate one keypress started a new conversation
   * in each. Mounted under a catch-all route at the chat's URL, which is that window exactly:
   * the buddy still rendered, the location already the other half's.
   */
  it("ignores Alt+N while the chat is the half on screen", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
    ]);

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <BuddyProvider>
          <Routes>
            <Route element={<AssistantShell />}>
              <Route path="*" element={<BuddyPage />} />
            </Route>
          </Routes>
        </BuddyProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("where do I start?")).toBeInTheDocument();

    await user.keyboard("{Alt>}n{/Alt}");

    // Still there: the visit was not restarted under the half the hire is actually looking at.
    expect(screen.getByText("where do I start?")).toBeInTheDocument();
  });

  /**
   * The load path refuses to restore an overlay below `md`; this is the same rule for the window
   * crossing that breakpoint afterwards. A rail opened as a column used to survive the narrowing
   * and become a drawer over the conversation, backdrop and all, that nobody had asked for.
   */
  it("puts the rail away when the window narrows past the breakpoint", async () => {
    const viewport = mockResizableViewport();

    try {
      renderPage();

      // A column, and an answer is waiting, so it opens itself.
      const rail = await screen.findByRole("complementary", {
        name: "What you sent to your PM",
      });
      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "false"));

      act(() => viewport.setDesktop(false));

      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "true"));

      // Put away, not taken away: the control that brings it back is on screen, with the count
      // read from the same list the rail is holding.
      expect(screen.getByTitle("What you sent to your PM")).toBeInTheDocument();
    } finally {
      viewport.restore();
    }
  });

  /**
   * The rail and its toggle were both `hidden … xl:*` once, which put a hire on anything
   * narrower than 1280px out of reach of their PM's answer entirely — the one thing
   * `FlagToPmButton` promises will show up here. It works like the chat's history rail now: a
   * column beside the conversation from `md` up, a drawer over it below that, one element
   * either way. jsdom computes no layout, so this asserts the contract that carries it —
   * neither piece is gated on a breakpoint.
   */
  it("keeps the PM's answer reachable on a narrow screen", async () => {
    const user = userEvent.setup();
    renderPage();

    const toggle = await screen.findByTitle("What you sent to your PM");
    expect(toggle.className).not.toMatch(/(^|\s)hidden(\s|$)/);

    await user.click(toggle);

    const rail = await screen.findByRole("complementary", { name: "What you sent to your PM" });
    expect(rail.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  /**
   * The same preference the chat's rail keeps, for the same reason: it says how much room this
   * window has to spare. Which is why it is a *column* the page remembers — see the drawer's
   * own case below.
   */
  it("remembers the rail being closed, where it is a column", async () => {
    const restoreViewport = reportDesktopViewport();

    try {
      const user = userEvent.setup();
      const first = renderPage();

      // A column, and there is an answer waiting: the rail opens itself, which is the promise
      // `FlagToPmButton` makes. Closing it is therefore the choice worth remembering here.
      const rail = await screen.findByRole("complementary", {
        name: "What you sent to your PM",
      });
      // Scoped to the rail: the drawer backdrop says the same words, and below `md` it is the
      // one you press. jsdom computes no layout, so both are in the document here.
      await user.click(within(rail).getByRole("button", { name: "Close the PM replies" }));

      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "true"));

      first.unmount();
      renderPage();

      // Back to the control that reopens it, rather than to the rail deciding again. The rail
      // itself stays mounted — that is what keeps its scroll — but out of the tree while shut.
      expect(await screen.findByTitle("What you sent to your PM")).toBeInTheDocument();
      expect(
        screen.queryByRole("complementary", { name: "What you sent to your PM" }),
      ).not.toBeInTheDocument();
    } finally {
      restoreViewport();
    }
  });

  /**
   * Below `md` the rail is a drawer over the conversation, with a backdrop. Somebody opens one
   * to read an answer and dismisses it again — that is not a hire saying how they want the page
   * laid out, and restoring it would land them behind their own PM replies on every visit. So
   * the preference is neither written nor honoured at this width; jsdom's default viewport is
   * already below it, which is what makes this the plain case.
   */
  it("does not reopen the drawer by itself on a phone", async () => {
    const user = userEvent.setup();
    const first = renderPage();

    await user.click(await screen.findByTitle("What you sent to your PM"));
    expect(
      await screen.findByRole("complementary", { name: "What you sent to your PM" }),
    ).toBeInTheDocument();

    first.unmount();
    renderPage();

    // Still mounted — the rail never unmounts, so its list keeps its scroll — but shut, and
    // the control that brings it back is the one on screen.
    expect(await screen.findByTitle("What you sent to your PM")).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "What you sent to your PM" }),
    ).not.toBeInTheDocument();
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
