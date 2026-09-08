import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useMotionValue } from "framer-motion";
import { describe, it, expect } from "vitest";
import { SidebarNavLink } from "../../../../src/components/layout/SidebarNavLink";
import { InboxIcon } from "../../../../src/components/layout/SidebarNavIcons";

function Harness({
  initialRoute = "/",
  ...props
}: Partial<React.ComponentProps<typeof SidebarNavLink>> & { initialRoute?: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Link {...props} />
    </MemoryRouter>
  );
}

// `pointerY` is a motion value, which has to come from inside a component.
function Link(props: Partial<React.ComponentProps<typeof SidebarNavLink>>) {
  const pointerY = useMotionValue(Number.NEGATIVE_INFINITY);

  return (
    <SidebarNavLink
      to="/insights/knowledge-requests"
      label="Escalation Inbox"
      icon={InboxIcon}
      indicatorLayoutId="pill"
      pointerY={pointerY}
      {...props}
    />
  );
}

describe("SidebarNavLink count", () => {
  it("shows how many are waiting behind the entry", () => {
    render(<Harness count={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("says nothing when there is nothing waiting", () => {
    render(<Harness count={0} />);

    expect(screen.queryByText("0")).toBeNull();
  });

  it("announces what the number counts, not just the figure", () => {
    render(<Harness count={3} countLabel={(open) => `${open} open escalations`} />);

    expect(screen.getByText("3 open escalations")).toBeInTheDocument();
  });

  it("takes the trailing slot from the active dot rather than sitting beside it", () => {
    const { container } = render(<Harness initialRoute="/insights/knowledge-requests" count={2} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    // The active dot is the only `bg-white` rounded pip in the row.
    expect(container.querySelector(".rounded-full.bg-white")).toBeNull();
  });

  it("still shows the active dot on an entry with nothing waiting", () => {
    const { container } = render(<Harness initialRoute="/insights/knowledge-requests" />);

    expect(container.querySelector(".rounded-full.bg-white")).not.toBeNull();
  });
});

/**
 * The sidebar has one way of saying "there is work behind this entry": an amber
 * icon that stirs every few seconds. The count arrived speaking a second one --
 * a brand-blue pill, on an entry whose icon stayed grey -- so the Escalation
 * Inbox looked like a different kind of thing from the Dashboard and PM
 * Dashboard entries when it was the same kind of thing with a number on it.
 */
describe("SidebarNavLink marker consistency", () => {
  const amberIcon = (container: HTMLElement) => container.querySelector(".text-app-warning-solid");

  it("marks a counted entry the same way as an uncounted one", () => {
    const counted = render(<Harness count={3} />).container;
    const flagged = render(<Harness hasAttentionMarker />).container;

    expect(amberIcon(counted)).not.toBeNull();
    expect(amberIcon(flagged)).not.toBeNull();
  });

  it("leaves an entry with nothing waiting unmarked", () => {
    const { container } = render(<Harness />);

    expect(amberIcon(container)).toBeNull();
  });

  it("wears the marker's amber rather than a palette of its own", () => {
    const { container } = render(<Harness count={3} />);

    const pill = screen.getByText("3");
    expect(pill).toHaveClass("bg-app-warning-bg", "text-app-warning-text");
    expect(pill.className).not.toContain("brand");
  });

  it("keeps that amber on the row the user is already on", () => {
    render(<Harness initialRoute="/insights/knowledge-requests" count={3} />);

    // The active row paints its contents white; the marker is the exception,
    // because a signal that changes colour with the route is two signals.
    expect(screen.getByText("3")).toHaveClass("bg-app-warning-bg", "text-app-warning-text");
  });

  /**
   * Both texts describe the same marker, so rendering both made a screen reader
   * read "Escalation Inbox, open escalations, 3 open escalations".
   */
  it("announces the count instead of the attention text, not both", () => {
    render(
      <Harness
        count={3}
        countLabel={(open) => `${open} open escalations`}
        attentionLabel="Open escalations"
      />,
    );

    expect(screen.getByText("3 open escalations")).toBeInTheDocument();
    expect(screen.queryByText("Open escalations")).toBeNull();
  });
});

/**
 * Regression: the attention text was rendered unconditionally, so every entry
 * in the sidebar announced "Needs attention" to a screen reader — which made
 * the one entry that really did need attention indistinguishable from the rest.
 */
describe("SidebarNavLink attention marker", () => {
  it("announces attention only where there is some", () => {
    render(<Harness hasAttentionMarker attentionLabel="Open skip requests" />);

    expect(screen.getByText("Open skip requests")).toBeInTheDocument();
  });

  it("says nothing about attention on an ordinary entry", () => {
    render(<Harness attentionLabel="Open skip requests" />);

    expect(screen.queryByText("Open skip requests")).toBeNull();
    expect(screen.queryByText("Needs attention")).toBeNull();
  });
});
