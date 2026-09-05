import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { useRailOverlayGuard } from "../../../src/hooks/useRailOverlayGuard";
import { useMediaQuery } from "../../../src/hooks/useMediaQuery";
import { RAIL_DESKTOP_QUERY } from "../../../src/components/layout/ConversationRail";
import { mockResizableViewport } from "../setup/matchMedia";

/**
 * Both rails in one shape: a piece of state that is honoured as a column and, below the
 * breakpoint, is a drawer over the page.
 */
function RailHarness() {
  const isOverlay = !useMediaQuery(RAIL_DESKTOP_QUERY);
  const [isOpen, setIsOpen] = useState(true);

  useRailOverlayGuard(isOverlay, () => setIsOpen(false));

  return (
    <>
      <p>{isOpen ? "rail open" : "rail closed"}</p>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open the rail
      </button>
    </>
  );
}

describe("useRailOverlayGuard", () => {
  let viewport: ReturnType<typeof mockResizableViewport> | undefined;

  afterEach(() => {
    viewport?.restore();
    viewport = undefined;
  });

  /**
   * The bug: the load path refuses to restore an overlay below `md`, but nothing watched the
   * window crossing that breakpoint afterwards. A rail opened as a column survived the
   * narrowing and became a panel over the conversation, backdrop and all, that nobody asked for.
   */
  it("closes a rail that has just become a drawer", () => {
    viewport = mockResizableViewport();

    render(<RailHarness />);
    expect(screen.getByText("rail open")).toBeInTheDocument();

    act(() => viewport!.setDesktop(false));

    expect(screen.getByText("rail closed")).toBeInTheDocument();
  });

  /** One way only: somebody who put the rail away meant it, at either width. */
  it("does not reopen anything when the window widens again", () => {
    viewport = mockResizableViewport();

    render(<RailHarness />);

    act(() => viewport!.setDesktop(false));
    act(() => viewport!.setDesktop(true));

    expect(screen.getByText("rail closed")).toBeInTheDocument();
  });

  /**
   * A drawer opened deliberately on a phone is not a rail that has just stopped fitting — there
   * is no crossing, and it has to stay open.
   */
  it("leaves a drawer that was opened by hand alone", async () => {
    const user = userEvent.setup();
    viewport = mockResizableViewport(false);

    render(<RailHarness />);

    // Mounting below the breakpoint is not a crossing: the guard leaves the initial state
    // alone, because refusing to *restore* an overlay is each rail's own job on the way in.
    expect(screen.getByText("rail open")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open the rail" }));

    expect(screen.getByText("rail open")).toBeInTheDocument();
  });
});
