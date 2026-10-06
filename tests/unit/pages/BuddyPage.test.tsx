import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BuddyPage } from "../../../src/pages/BuddyPage";
import { BuddyProvider } from "../../../src/features/buddy/BuddyProvider";
import { mockResizableViewport } from "../setup/matchMedia";

const projectState = { selectedProjectId: "p1" };

/**
 * Whether this hire has ever escalated anything. Mutable, because the two branches lead to
 * different layouts: with replies the rail toggle reserves the floating control's room on its
 * own, and without them the buddy's own control is the only thing that ever asks for it.
 */
const pmRepliesState = { hasAny: true };

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

vi.mock("../../../src/services/buddyService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  getSessions: vi.fn(),
  createSession: vi.fn(),
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
    hasAny: pmRepliesState.hasAny,
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

import {
  createSession,
  getMessages,
  getSessions,
  getSuggestions,
  streamOpenBuddy,
  streamMessage,
} from "../../../src/services/buddyService";

/**
 * The conversation the defaults put on screen: one, empty, so the page greets it. The id is
 * what every request the page makes should carry — the tests that check that name it in their
 * own mocks.
 */
const defaultSession = {
  id: "s1",
  title: "",
  projectId: null,
  createdAt: "2026-09-30T09:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/buddy"]}>
      {/* The conversation belongs to the provider, not to the page — the page is one of two
                views of it. Rendering the page without one is not a supported arrangement, and
                `useBuddySession` says so rather than quietly making a second conversation.

                The page draws its own header and frame now; it used to be a panel inside a
                layout route shared with the chat, and this harness carried that arrangement
                until the two surfaces became one. */}
      <BuddyProvider>
        <Routes>
          <Route path="/buddy" element={<BuddyPage />} />
          {/* The per-conversation address the dock's expand hands over — part of the real
            arrangement since the page gained it, so the harness carries it too. */}
          <Route path="/buddy/:id" element={<BuddyPage />} />
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
    pmRepliesState.hasAny = true;
    // The rail's collapsed state is remembered per browser, so one test's choice would
    // otherwise decide the next one's starting layout.
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    projectState.selectedProjectId = "p1";
    // `clearAllMocks` drops the module mock's resolved values too, so the defaults — one empty
    // conversation, the case that greets, and a second one for the control that asks for it —
    // have to be restored per test.
    vi.mocked(getMessages).mockResolvedValue([]);
    vi.mocked(getSessions).mockResolvedValue([defaultSession]);
    vi.mocked(createSession).mockResolvedValue("s2");
  });

  it("opens the conversation for a hire who is not on a project yet", async () => {
    projectState.selectedProjectId = "";
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
      {
        role: "ASSISTANT",
        content: "With the setup guide.",
        createdAt: "2026-08-24T10:00:01.000Z",
      },
    ]);

    renderPage();

    // No dead end: the hire's buddy is not one project's, and everyone arriving here from the
    // retired `/chat` has nowhere else to be sent. The page opens the conversation as usual.
    expect(await screen.findByText("where do I start?")).toBeInTheDocument();
    expect(screen.getByText("With the setup guide.")).toBeInTheDocument();
  });

  /**
   * The bug this replaced: the page opened a visit unconditionally, before reading anything, so
   * asking something in the dock and then opening the full page showed a greeting where the
   * conversation had been. Conversations are read now, and a conversation that already has
   * words in it is never greeted again — the greeting belongs to the conversation, and a
   * second one *under* the transcript is what the visit divider used to explain. Both are gone
   * with the visit model.
   */
  it("keeps the conversation on screen, and does not greet again over it", async () => {
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
    // No re-greeting, and no divider: reopening a conversation reads it.
    expect(screen.queryByText("Welcome back!")).toBeNull();
    expect(streamOpenBuddy).not.toHaveBeenCalled();
  });

  /**
   * A new conversation is created server-side and switched to, empty — the hire speaks first.
   * Nothing is deleted: the conversation being left keeps its transcript, stays in the list,
   * and the buddy's durable memory note, which the next greeting is written from, is untouched.
   */
  it("starts a new conversation from the standing control", async () => {
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

    await user.click(await screen.findByRole("button", { name: "Start a new conversation" }));

    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });
    // Created and switched to — and not greeted: a new conversation starts empty.
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(streamOpenBuddy).not.toHaveBeenCalled();
  });

  /**
   * The second visible way to start a conversation: the dock's own copy of this control floats
   * over every other page, and `Alt+N` is invisible to anybody who was never told about it — so
   * a hire looking for "start again" on this page needs one that is simply there.
   */
  it("offers a standing control once there is a conversation to leave behind", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
    ]);

    renderPage();

    expect(
      await screen.findByRole("button", { name: "Start a new conversation" }),
    ).toBeInTheDocument();
  });

  it("keeps it off a visit nobody has spoken in — that visit is already the fresh one", async () => {
    vi.mocked(getMessages).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Welcome back!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start a new conversation" })).toBeNull();
  });

  it("starts a new conversation from it, and says which chord does the same", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
    ]);

    const user = userEvent.setup();
    renderPage();

    const control = await screen.findByRole("button", { name: "Start a new conversation" });
    expect(control).toHaveAttribute(
      "title",
      "Start a new conversation (Alt + N) — your buddy keeps what it has learned about you",
    );

    await user.click(control);

    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  /**
   * The button withdraws mid-turn; the room it withdraws from must not.
   *
   * Below `md` the two clearances differ by 24px, and a hire with no PM replies has no other
   * reason to reserve any — so tying the space to the button meant the whole transcript slid
   * down and back on every turn. Visible precisely while the transcript is shorter than the
   * viewport, which is the first few turns this control exists for.
   *
   * The room lives in the mode row: when it renders it is the element the floating controls
   * overlap, so the row reserves the space from the stable facts (this conversation has been
   * spoken in) and the transcript below adds no second gap of its own.
   */
  it("keeps the room the floating control needs, even while the control is withdrawn", async () => {
    // No PM replies, so the rail toggle is not there to reserve the room on the button's
    // behalf — which is the ordinary hire, and the only configuration where this can be seen.
    pmRepliesState.hasAny = false;
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
    ]);
    vi.mocked(streamMessage).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderPage();

    const band = () => screen.getByTestId("buddy-mode-band");
    const framed = () =>
      screen.getByTestId("buddy-transcript").querySelector(".app-page-frame") as HTMLElement;

    expect(await screen.findByRole("button", { name: "Start a new conversation" })).toBeVisible();
    expect(band().className).toContain("pt-14");
    // The floor is the phone value up to `min-[1660px]` — below that the fluid page gutter is
    // narrower than the counted rail toggle's halo, and the select sits at the gutter edge.
    expect(band().className).toContain("min-[1660px]:pt-4");
    // One reservation, not two: the transcript adds none under the mode row.
    expect(framed().className).toContain("pt-8");

    await user.type(screen.getByLabelText("Message"), "and after that?");
    await user.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Start a new conversation" })).toBeNull();
    });
    // The control is gone and the padding it stands in has not moved.
    expect(band().className).toContain("pt-14");
    expect(framed().className).toContain("pt-8");
  });

  /**
   * The row is capped on phones — five wrapped chips at reading size take the composer's half of
   * a small screen — but the cap is the count, not the type: the chips keep the size the rest of
   * the page reads at, and only the dock's compact row shrinks.
   */
  it("caps the suggestion row at three on a phone, at reading size", async () => {
    vi.mocked(getSuggestions).mockResolvedValue([
      { label: "What should I work on?", question: "What should I work on next?" },
      { label: "Who reviews my PRs?", question: "Who reviews my pull requests?" },
      { label: "Where are the runbooks?", question: "Where do I find the runbooks?" },
      { label: "How do I get staging access?", question: "How do I get staging credentials?" },
      { label: "When is the release train?", question: "When does the next release train leave?" },
    ]);

    renderPage();

    const row = within(await screen.findByTestId("buddy-suggestions"));
    const chips = await row.findAllByRole("button");
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip.className).toContain("text-sm");
      expect(chip.className).not.toContain("text-xs");
    }
  });

  /**
   * Both routes withdraw together while a reply is in flight, and they have to: they call one
   * function. `newConversation` clears the thread, but cannot call back the request already
   * streaming into it — that stream's callbacks hold the shared session, so its tool events
   * land in the new conversation and its completion clears its thinking state. Leaving either
   * route live mid-turn would be a door onto that bug.
   */
  it("withdraws every way of starting a conversation while a reply is still arriving", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { role: "USER", content: "where do I start?", createdAt: "2026-08-24T10:00:00.000Z" },
      {
        role: "ASSISTANT",
        content: "With the setup guide.",
        createdAt: "2026-08-24T10:00:01.000Z",
      },
    ]);
    // A turn that starts and never finishes: `isThinking` stays true for the rest of the test.
    vi.mocked(streamMessage).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("button", { name: "Start a new conversation" })).toBeVisible();

    await user.type(screen.getByLabelText("Message"), "and after that?");
    await user.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Start a new conversation" })).toBeNull();
    });

    // The chord is gated on the same condition, so it is not a way around the button.
    await user.keyboard("{Alt>}n{/Alt}");

    expect(screen.getByText("where do I start?")).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  /**
   * `Alt+N` rather than `Ctrl+N`, which every desktop browser owns. It fires while the composer
   * has focus on purpose — halfway through typing into the wrong conversation is exactly when
   * somebody reaches for it.
   */
  it("starts a new conversation on Alt+N", async () => {
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
    expect(createSession).toHaveBeenCalledTimes(1);
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
        name: "Your conversations",
      });
      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "false"));

      act(() => viewport.setDesktop(false));

      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "true"));

      // Put away, not taken away: the control that brings it back is on screen, with the count
      // read from the same list the rail is holding.
      expect(screen.getByTitle("Your conversations")).toBeInTheDocument();
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

    const toggle = await screen.findByTitle("Your conversations");
    expect(toggle.className).not.toMatch(/(^|\s)hidden(\s|$)/);

    await user.click(toggle);

    const rail = await screen.findByRole("complementary", { name: "Your conversations" });
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
        name: "Your conversations",
      });
      // Scoped to the rail's own cross: the drawer backdrop says the same words, and below `md`
      // it is the one you press. jsdom computes no layout, so both are in the document here.
      await user.click(within(rail).getByRole("button", { name: "Close your conversations" }));

      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "true"));

      first.unmount();
      renderPage();

      // Back to the control that reopens it, rather than to the rail deciding again. The rail
      // itself stays mounted — that is what keeps its scroll — but out of the tree while shut.
      expect(await screen.findByTitle("Your conversations")).toBeInTheDocument();
      expect(
        screen.queryByRole("complementary", { name: "Your conversations" }),
      ).not.toBeInTheDocument();
    } finally {
      restoreViewport();
    }
  });

  /**
   * The way out of the rail from `md` up: while it is open the toggle that opened it is gone
   * and the drawer's backdrop only exists below `md`, so the rail's own cross has to be there
   * for a hire with conversations and no replies. Same words as the backdrop, because it is
   * the same act.
   */
  it("closes the rail from the conversations list", async () => {
    const restoreViewport = reportDesktopViewport();

    try {
      pmRepliesState.hasAny = false;
      vi.mocked(getSessions).mockResolvedValue([
        { ...defaultSession, title: "Getting started" },
        { ...defaultSession, id: "s2" },
      ]);

      const user = userEvent.setup();
      renderPage();

      // Open the rail the way a hire does: there is something to switch to, so the toggle is
      // offered; nothing is waiting from a PM, so it did not open itself.
      await user.click(await screen.findByTitle("Your conversations"));

      const rail = await screen.findByRole("complementary", { name: "Your conversations" });
      await user.click(within(rail).getByRole("button", { name: "Close your conversations" }));

      await waitFor(() => expect(rail).toHaveAttribute("aria-hidden", "true"));

      // Back to the control that brings it again.
      expect(await screen.findByTitle("Your conversations")).toBeInTheDocument();
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

    await user.click(await screen.findByTitle("Your conversations"));
    expect(
      await screen.findByRole("complementary", { name: "Your conversations" }),
    ).toBeInTheDocument();

    first.unmount();
    renderPage();

    // Still mounted — the rail never unmounts, so its list keeps its scroll — but shut, and
    // the control that brings it back is the one on screen.
    expect(await screen.findByTitle("Your conversations")).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Your conversations" }),
    ).not.toBeInTheDocument();
  });

  /**
   * Conversations replace visits: once there is more than one, the rail lists them, and picking
   * one reads it again. The list is what keeps "new conversation" from being one-way — the
   * conversation you left is still there, one click away, transcript intact.
   */
  it("lists the conversations and switches between them", async () => {
    vi.mocked(getSessions).mockResolvedValue([{ ...defaultSession, title: "Getting started" }]);
    vi.mocked(getMessages).mockImplementation((sessionId) =>
      Promise.resolve(
        sessionId === "s1"
          ? [
              {
                role: "USER" as const,
                content: "where do I start?",
                createdAt: "2026-08-24T10:00:00.000Z",
              },
            ]
          : [],
      ),
    );

    const user = userEvent.setup();
    renderPage();

    // Start a second one from the standing control...
    await user.click(await screen.findByRole("button", { name: "Start a new conversation" }));
    await waitFor(() => {
      expect(screen.queryByText("where do I start?")).not.toBeInTheDocument();
    });

    // ...open the rail (there is something to switch to now), and pick the older one.
    await user.click(await screen.findByTitle("Your conversations"));
    await user.click(await screen.findByRole("button", { name: "Getting started" }));

    // Its transcript comes back, read by id.
    expect(await screen.findByText("where do I start?")).toBeInTheDocument();
    expect(getMessages).toHaveBeenLastCalledWith("s1");
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
