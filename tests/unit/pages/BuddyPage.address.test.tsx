import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BuddyPage } from "../../../src/pages/BuddyPage";
import { BuddyProvider } from "../../../src/features/buddy/BuddyProvider";
import type { BuddyStreamHandlers } from "../../../src/features/buddy/types";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

vi.mock("../../../src/services/buddyService", () => ({
  getMessages: vi.fn(),
  getSessions: vi.fn(),
  createSession: vi.fn(),
  streamOpenBuddy: vi.fn(() => Promise.resolve()),
  streamMessage: vi.fn(),
  performAction: vi.fn(),
  getSuggestions: vi.fn().mockResolvedValue([]),
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

// The composer's source filter asks which connectors exist; nothing here is about that.
vi.mock("../../../src/services/connectorService", () => ({
  connectorService: { listConnectors: vi.fn().mockResolvedValue([]) },
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
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "p1", name: "Project One" }),
      }),
  };
});

import { getMessages, getSessions, streamMessage } from "../../../src/services/buddyService";

const FIRST = { id: "s1", title: "First", projectId: null, createdAt: "2026-09-30T09:00:00.000Z" };
const SECOND = {
  id: "s2",
  title: "Second",
  projectId: null,
  createdAt: "2026-09-29T09:00:00.000Z",
};
const THIRD = { id: "s3", title: "Third", projectId: null, createdAt: "2026-10-01T09:00:00.000Z" };

/** Each conversation's transcript, one line, so a test can tell which one is on screen. */
function transcriptOf(sessionId: string | undefined) {
  return Promise.resolve([
    {
      role: "USER" as const,
      content: `said in ${sessionId}`,
      createdAt: "2026-09-30T10:00:00.000Z",
    },
  ]);
}

/** Shows the address, and moves it the way the back button or a link would. */
function AddressProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="address">{location.pathname}</output>
      <button type="button" onClick={() => void navigate("/buddy/s2")}>
        go to s2
      </button>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BuddyProvider>
        <AddressProbe />
        <Routes>
          <Route path="/buddy" element={<BuddyPage />} />
          <Route path="/buddy/:id" element={<BuddyPage />} />
        </Routes>
      </BuddyProvider>
    </MemoryRouter>,
  );
}

const address = () => screen.getByTestId("address").textContent;

/**
 * The page's address and the conversation on screen, kept in step — `/buddy/:id` is what the
 * dock's expand hands over, what a reload lands on, and what the back button moves through.
 */
describe("BuddyPage address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(getSessions).mockResolvedValue([FIRST, SECOND]);
    vi.mocked(getMessages).mockImplementation(transcriptOf);
  });

  it("opens the conversation a deep link names", async () => {
    renderAt("/buddy/s2");

    expect(await screen.findByText("said in s2")).toBeInTheDocument();
    expect(address()).toBe("/buddy/s2");
  });

  it("resolves a reload straight to the addressed conversation, never reading the newest first", async () => {
    // The dock resolves at app mount, before the page could hand the address over — so the
    // resolve reads it off the window itself.
    const previousUrl = window.location.href;
    window.history.replaceState(null, "", "/buddy/s2");

    try {
      renderAt("/buddy/s2");

      expect(await screen.findByText("said in s2")).toBeInTheDocument();
      expect(getMessages).not.toHaveBeenCalledWith("s1");
    } finally {
      window.history.replaceState(null, "", previousUrl);
    }
  });

  it("re-reads the list once before giving up on an unknown address", async () => {
    // A conversation started in another tab is newer than this session's read.
    vi.mocked(getSessions)
      .mockResolvedValueOnce([FIRST, SECOND])
      .mockResolvedValue([THIRD, FIRST, SECOND]);

    renderAt("/buddy/s3");

    expect(await screen.findByText("said in s3")).toBeInTheDocument();
    expect(address()).toBe("/buddy/s3");
  });

  it("falls back to the bare page when the re-read does not know the address either", async () => {
    renderAt("/buddy/gone");

    await waitFor(() => expect(address()).toBe("/buddy"));
    expect(getSessions).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("said in s1")).toBeInTheDocument();
  });

  it("takes the address along when the hire picks another conversation", async () => {
    const user = userEvent.setup();
    renderAt("/buddy");

    expect(await screen.findByText("said in s1")).toBeInTheDocument();
    // The first resolve keeps the bare page's bare address.
    expect(address()).toBe("/buddy");

    await user.click(await screen.findByTitle("Your conversations"));
    await user.click(await screen.findByRole("button", { name: "Second" }));

    expect(await screen.findByText("said in s2")).toBeInTheDocument();
    await waitFor(() => expect(address()).toBe("/buddy/s2"));
  });

  /**
   * The bug this replaced: an address that could not be followed mid-turn was followed later,
   * on its own — the switch fired the moment the answer finished, and a switch clears the
   * composer, so a follow-up typed in the meantime was gone. Until then the address named a
   * conversation the screen was not showing.
   */
  it("puts the address back instead of switching later when it moves mid-turn", async () => {
    let handlers: BuddyStreamHandlers | null = null;
    let finish: () => void = () => {};
    vi.mocked(streamMessage).mockImplementation((_content, streamHandlers) => {
      handlers = streamHandlers;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });

    const user = userEvent.setup();
    renderAt("/buddy/s1");
    expect(await screen.findByText("said in s1")).toBeInTheDocument();

    const composer = screen.getByRole("textbox", { name: "Message" });
    await user.type(composer, "Q1{Enter}");
    await waitFor(() => expect(streamMessage).toHaveBeenCalled());
    await user.type(composer, "a follow-up");

    await user.click(screen.getByRole("button", { name: "go to s2" }));

    await waitFor(() => expect(address()).toBe("/buddy/s1"));
    expect(getMessages).not.toHaveBeenCalledWith("s2");

    // The turn ends — and nothing switches behind the hire's back.
    handlers!.onDone();
    finish();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop generation" })).toBeNull(),
    );

    expect(getMessages).not.toHaveBeenCalledWith("s2");
    expect(address()).toBe("/buddy/s1");
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("a follow-up");
  });
});

describe("BuddyPage keyboard and header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(getSessions).mockResolvedValue([FIRST]);
    vi.mocked(getMessages).mockImplementation(transcriptOf);
  });

  afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });

  it("puts the caret in the composer on `/`, the chord the shortcut help lists", async () => {
    const user = userEvent.setup();
    renderAt("/buddy");
    expect(await screen.findByText("said in s1")).toBeInTheDocument();

    const composer = screen.getByRole("textbox", { name: "Message" });
    composer.blur();
    expect(composer).not.toHaveFocus();

    await user.keyboard("/");

    expect(composer).toHaveFocus();
    // The chord is answered, not typed.
    expect(composer).toHaveValue("");
  });

  it("counts PM answers not looked at yet, and forgets the count once the drawer was opened", async () => {
    const user = userEvent.setup();
    const first = renderAt("/buddy");

    const button = await screen.findByRole("button", {
      name: "Sent to your PM — 1 not looked at yet",
    });
    await user.click(button);
    expect(await screen.findByText("Ask in #platform.")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(await screen.findByRole("button", { name: /^Sent to your PM$/ })).toBeInTheDocument();
    // Per user, by id: an answer read yesterday must not make today's look seen.
    expect(JSON.parse(window.localStorage.getItem("buddyPmRepliesSeen:u1") ?? "[]")).toEqual([
      "r1",
    ]);

    first.unmount();
    renderAt("/buddy");

    expect(await screen.findByRole("button", { name: /^Sent to your PM$/ })).toBeInTheDocument();
  });
});
