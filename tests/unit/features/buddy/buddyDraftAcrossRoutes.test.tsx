import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import {
  BuddyDraftActionsContext,
  BuddyDraftContext,
  useBuddyDraft,
} from "../../../../src/features/buddy/buddyDraftContext";
import { BuddyDraftProvider } from "../../../../src/features/buddy/BuddyDraftProvider";
import {
  BuddySessionContext,
  type BuddySession,
} from "../../../../src/features/buddy/buddySessionContext";

/**
 * The composer's words across navigation.
 *
 * They used to be carried in history state — the dock navigated to `/buddy` with the draft in
 * `location.state`, and a hook on the page applied it on arrival. That was a second mechanism for
 * something the shape of the app already gives: `BuddyDraftProvider` sits above the router, so the
 * dock and the page read one box and the hand-off is the same conversation drawn wider. Keeping
 * the copy was also what tied the widget's `goToPage` to the draft, and with it every keystroke to
 * the dock (issue #236) — so these tests hold the replacement in place.
 */
describe("the composer's words across navigation", () => {
  /** Stands in for the dock's composer and its "open full" control. */
  function Dock() {
    const { draft, setDraft } = useBuddyDraft();
    const navigate = useNavigate();

    return (
      <>
        <label>
          dock box
          <input value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button type="button" onClick={() => void navigate("/buddy")}>
          open full
        </button>
      </>
    );
  }

  /** The page's box, plus the two history moves the second test needs. */
  function Page() {
    const { draft, setDraft } = useBuddyDraft();
    const navigate = useNavigate();

    return (
      <>
        <output data-testid="page-box">{draft}</output>
        <button type="button" onClick={() => setDraft("")}>
          clear
        </button>
        <button type="button" onClick={() => void navigate(-1)}>
          back
        </button>
      </>
    );
  }

  function Board() {
    const navigate = useNavigate();

    return (
      <>
        <Dock />
        <button type="button" onClick={() => void navigate(1)}>
          forward
        </button>
      </>
    );
  }

  /**
   * The app's own shape: the provider above the router, so the one box outlives any single route.
   * The session is stubbed to the things the draft provider reads from it — the submit, and the
   * conversation each draft is filed under.
   */
  function renderApp() {
    const session = {
      submitMessage: vi.fn(),
      currentSessionId: null,
      teamProjectId: null,
    } as unknown as BuddySession;

    return render(
      <BuddySessionContext.Provider value={session}>
        <BuddyDraftProvider>
          <MemoryRouter initialEntries={["/board"]}>
            <Routes>
              <Route path="/board" element={<Board />} />
              <Route path="/buddy" element={<Page />} />
            </Routes>
          </MemoryRouter>
        </BuddyDraftProvider>
      </BuddySessionContext.Provider>,
    );
  }

  it("are the same words on the page as in the dock", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("dock box"), "how do I run the migrations");
    await user.click(screen.getByRole("button", { name: "open full" }));

    expect(screen.getByTestId("page-box")).toHaveTextContent("how do I run the migrations");
  });

  it("do not come back once cleared — nothing of the box rides in history", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("dock box"), "half a question");
    await user.click(screen.getByRole("button", { name: "open full" }));

    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByTestId("page-box")).toBeEmptyDOMElement();

    // Back to the board, then forward again — the very history entry the dock navigated to. With
    // a draft carried in that entry's state, arriving here re-seeded the box with words the hire
    // had since deleted.
    await user.click(screen.getByRole("button", { name: "back" }));
    await user.click(screen.getByRole("button", { name: "forward" }));

    expect(screen.getByTestId("page-box")).toBeEmptyDOMElement();
  });
});

describe("the dock’s hand-off control", () => {
  /**
   * The dock takes its words from the shared composer (`BuddyDraftProvider`): its chips fill the
   * box through the write-only half, and the composer inside reads the value. Standing the two
   * contexts in for the provider is the only way to render it — and `draft` is the box's
   * contents, which is what the hand-off is about.
   */
  function withDraft(node: ReactNode, draft = "") {
    return (
      <BuddyDraftActionsContext.Provider value={{ setDraft: vi.fn() }}>
        <BuddyDraftContext.Provider value={{ draft, setDraft: vi.fn(), handleSubmit: vi.fn() }}>
          {node}
        </BuddyDraftContext.Provider>
      </BuddyDraftActionsContext.Provider>
    );
  }

  it("is absent on the page it would open", async () => {
    // Guarded in BuddyWidget rather than here; this documents the intent that a control
    // offering the page you are already reading is not offered at all.
    const { BuddyDock } = await import("../../../../src/features/buddy/components/BuddyDock");

    render(
      withDraft(
        <BuddyDock
          messages={[]}
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
          onClose={vi.fn()}
        />,
      ),
    );

    expect(screen.queryByLabelText("Open the full buddy page")).not.toBeInTheDocument();
  });

  it("is offered when there is somewhere to go", async () => {
    const { BuddyDock } = await import("../../../../src/features/buddy/components/BuddyDock");
    const onOpenFull = vi.fn();
    const user = userEvent.setup();

    render(
      withDraft(
        <BuddyDock
          messages={[]}
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
          onClose={vi.fn()}
          onOpenFull={onOpenFull}
        />,
        "half a question",
      ),
    );

    await user.click(screen.getByLabelText("Open the full buddy page"));

    expect(onOpenFull).toHaveBeenCalled();
  });
});
