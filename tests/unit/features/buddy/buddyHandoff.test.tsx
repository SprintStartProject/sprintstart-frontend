import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { announceBuddyPageReady } from "../../../../src/features/buddy/aiBuddyBus";
import { BuddyWidget } from "../../../../src/features/buddy/components/BuddyWidget";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [createSelectableProject({ id: "p1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "p1", name: "Project One" }),
      }),
  };
});

/**
 * Stands in for `/buddy`. It has to announce itself exactly as the real page does: that signal
 * is what completes the hand-off early, which is the case the stray fallback then fired *on top
 * of*. A stub that stayed silent would leave the fallback as the only path and hide the bug.
 */
function StandInBuddyPage() {
  useEffect(() => {
    announceBuddyPageReady();
  }, []);

  return <p>the buddy page</p>;
}

/** The real page is not rendered here — the point is what the widget does around it. */
function renderWidget() {
  return render(
    <MemoryRouter initialEntries={["/board"]}>
      <BuddyProvider>
        <Routes>
          <Route path="/board" element={<p>the board</p>} />
          <Route
            path="/buddy"
            element={
              <>
                <StandInBuddyPage />
                {/* The way back out, because that is where the regression shows: the widget
                                    hides itself on /buddy, so a dock wrongly left open is invisible
                                    until the hire goes somewhere else. */}
                <Link to="/board">leave</Link>
              </>
            }
          />
        </Routes>
        <BuddyWidget />
      </BuddyProvider>
    </MemoryRouter>,
  );
}

/**
 * The hand-off to `/buddy` runs on timers because navigation is not synchronous, and a timer
 * nobody cancels is a bug waiting for the user to have moved on.
 *
 * This one had teeth: the fallback that exists in case the page never announces itself was left
 * armed after a successful hand-off, and it set the phase unconditionally. It re-entered the
 * sequence 1.2s later and toggled the dock — which by then was closed — back open.
 */
describe("the dock's hand-off to the buddy page", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  // Real timers rather than fake ones: the sequence runs through React Router's
  // `startTransition`, and driving that with a mocked clock tests the mock more than the code.
  // The whole hand-off is under two seconds, and the fallback's own deadline is inside that.
  it("leaves the dock closed once the hand-off has finished", async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(await screen.findByRole("button", { name: "Open buddy chat" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Onboarding buddy" })).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Open the full buddy page"));

    await waitFor(() => {
      expect(screen.getByText("the buddy page")).toBeInTheDocument();
    });

    // Wait out the fallback's whole deadline. It only exists in case the page never announces
    // itself; here it did, so nothing should come of it.
    await new Promise((resolve) => setTimeout(resolve, 2200));

    await user.click(screen.getByRole("link", { name: "leave" }));

    // Back on an ordinary page, the buddy is a launcher in the corner and nothing else. The
    // stray fallback used to re-enter the sequence and toggle `isOpen` back on, so the dock
    // greeted the hire uninvited on whatever page they went to next.
    expect(await screen.findByText("the board")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Onboarding buddy" })).not.toBeInTheDocument();
  });
});
