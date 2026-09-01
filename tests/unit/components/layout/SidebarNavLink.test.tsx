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
