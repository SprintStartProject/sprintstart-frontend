import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useHandedOffDraft } from "../../../../src/features/buddy/useHandedOffDraft";
import {
  BuddyDraftActionsContext,
  BuddyDraftContext,
} from "../../../../src/features/buddy/buddyDraftContext";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

/** A page whose composer is seeded by whatever the panel handed over. */
function Destination() {
  const [draft, setDraft] = useState("already here");
  useHandedOffDraft(setDraft);
  return <output data-testid="draft">{draft}</output>;
}

/** Stands in for the panel's "open full" control. */
function Origin({ draft }: { draft?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate("/buddy", { state: { draft } })}>
      open full
    </button>
  );
}

function renderHandoff(draft?: string) {
  return render(
    <MemoryRouter initialEntries={["/board"]}>
      <Routes>
        <Route path="/board" element={<Origin draft={draft} />} />
        <Route path="/buddy" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("useHandedOffDraft", () => {
  /**
   * The panel and the page share a session but not a composer. A hand-off that dropped the draft
   * would silently throw away what somebody was part-way through typing — worse than not
   * offering the control.
   */
  it("carries a part-typed question across to the page", async () => {
    const user = userEvent.setup();
    renderHandoff("how do I run the migrations");

    await user.click(screen.getByRole("button", { name: "open full" }));

    await waitFor(() => {
      expect(screen.getByTestId("draft")).toHaveTextContent("how do I run the migrations");
    });
  });

  /**
   * Writing an empty string over whatever the page already had would be a regression of its own —
   * there is simply nothing to carry.
   */
  it("leaves the composer alone when nothing was typed", async () => {
    const user = userEvent.setup();
    renderHandoff("   ");

    await user.click(screen.getByRole("button", { name: "open full" }));

    await waitFor(() => {
      expect(screen.getByTestId("draft")).toHaveTextContent("already here");
    });
  });

  it("does nothing when the page is reached without a hand-off", () => {
    render(
      <MemoryRouter initialEntries={["/buddy"]}>
        <Routes>
          <Route path="/buddy" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("draft")).toHaveTextContent("already here");
  });

  /**
   * History state outlives the navigation. Without clearing it, a reload or a back-and-forward
   * would re-seed a draft the hire has since sent or deleted, overwriting the box.
   */
  it("consumes the draft so it cannot be applied twice", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];

    function Recording() {
      const [draft, setDraft] = useState("");
      useHandedOffDraft((value) => {
        seen.push(value);
        setDraft(value);
      });
      return <output data-testid="draft">{draft}</output>;
    }

    render(
      <MemoryRouter initialEntries={["/board"]}>
        <Routes>
          <Route path="/board" element={<Origin draft="once" />} />
          <Route path="/buddy" element={<Recording />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "open full" }));
    await waitFor(() => {
      expect(screen.getByTestId("draft")).toHaveTextContent("once");
    });

    expect(seen).toEqual(["once"]);
  });
});

describe("the dock’s hand-off control", () => {
  /**
   * The dock takes its words from the shared composer now (`BuddyDraftProvider`): its chips fill
   * the box through the write-only half, and the composer inside reads the value. Standing the
   * two contexts in for the provider is the only way to render it — and `draft` is the box's
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
          activeTool={null}
          confirmAction={vi.fn()}
          dismissAction={vi.fn()}
          suggestions={[]}
          startFreshVisit={vi.fn()}
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
          activeTool={null}
          confirmAction={vi.fn()}
          dismissAction={vi.fn()}
          suggestions={[]}
          startFreshVisit={vi.fn()}
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
