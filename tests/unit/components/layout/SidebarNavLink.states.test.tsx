import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useMotionValue, type MotionValue } from "framer-motion";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarNavLink } from "../../../../src/components/layout/SidebarNavLink";
import { InboxIcon } from "../../../../src/components/layout/SidebarNavIcons";
import { createProjectContextValue } from "../../setup/projectContext";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motion.reduced,
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => createProjectContextValue(),
}));

type Props = Partial<React.ComponentProps<typeof SidebarNavLink>>;

let pointer: MotionValue<number> | null = null;

function Link(props: Props) {
  const pointerY = useMotionValue(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    pointer = pointerY;
  }, [pointerY]);

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

function renderLink(props: Props = {}, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Link {...props} />
    </MemoryRouter>,
  );
}

const ACTIVE = "/insights/knowledge-requests";

let rectTop = 100;

beforeEach(() => {
  motion.reduced = false;
  rectTop = 100;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    top: rectTop,
    height: 40,
    right: 200,
    left: 0,
    bottom: rectTop + 40,
    width: 200,
    x: 0,
    y: rectTop,
    toJSON: () => ({}),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SidebarNavLink — trailing slot", () => {
  it("shows a busy spinner with its words, in the brand colour or white when active", () => {
    const { container, unmount } = renderLink({ busy: true, busyLabel: "Building your path" });
    expect(screen.getByRole("status")).toHaveTextContent("Building your path");
    expect(container.querySelector(".animate-spin, .motion-safe\\:animate-spin")).toHaveClass(
      "border-app-brand",
    );
    unmount();

    const active = renderLink({ busy: true }, ACTIVE);
    expect(screen.getByRole("status")).toHaveTextContent("In progress");
    expect(active.container.querySelector("[class*='animate-spin']")).toHaveClass("border-white");
  });

  it("prefers the spinner over a count", () => {
    renderLink({ busy: true, count: 4 });
    expect(screen.queryByText("4")).toBeNull();
  });

  it("puts the spinner and the count on the icon's corner when folded", () => {
    const { container, unmount } = renderLink({ busy: true, collapsed: true });
    expect(screen.getByRole("status")).toHaveClass("absolute");
    unmount();

    renderLink({ count: 2, collapsed: true });
    expect(screen.getByText("2").parentElement).toHaveClass("absolute");
    expect(container).toBeTruthy();
  });

  it("keeps the count beside the label, not absolute, when open", () => {
    renderLink({ count: 2 });
    expect(screen.getByText("2").parentElement).toHaveClass("ml-auto");
    expect(screen.getByText("2").parentElement).not.toHaveClass("absolute");
  });

  it("puts the count's words in a tooltip title only when folded", () => {
    const label = (n: number) => `${n} open escalations`;
    const { unmount } = renderLink({ count: 2, countLabel: label, collapsed: true });
    expect(screen.getByText("2").parentElement).toHaveAttribute("title", "2 open escalations");
    unmount();

    renderLink({ count: 2, countLabel: label });
    expect(screen.getByText("2").parentElement).not.toHaveAttribute("title");
  });

  it("falls back to '<n> waiting' for a screen reader", () => {
    renderLink({ count: 5 });
    expect(screen.getByText("5 waiting")).toHaveClass("sr-only");
  });

  it("shows the active dot only on an open, active, quiet entry", () => {
    const { container, unmount } = renderLink({}, ACTIVE);
    expect(container.querySelector(".h-\\[6px\\]")).not.toBeNull();
    unmount();

    const folded = renderLink({ collapsed: true }, ACTIVE);
    expect(folded.container.querySelector(".h-\\[6px\\]")).toBeNull();
    folded.unmount();

    const idle = renderLink({});
    expect(idle.container.querySelector(".h-\\[6px\\]")).toBeNull();
  });
});

describe("SidebarNavLink — icon and attention", () => {
  it("wears the amber when something waits, white when active, muted otherwise", () => {
    const attention = renderLink({ hasAttentionMarker: true });
    expect(attention.container.querySelector(".text-app-warning-solid")).not.toBeNull();
    attention.unmount();

    const active = renderLink({}, ACTIVE);
    expect(active.container.querySelector(".relative.flex.shrink-0")).toHaveClass("text-white");
    active.unmount();

    const idle = renderLink({});
    const icon = idle.container.querySelector(".relative.flex.shrink-0");
    expect(icon).toHaveClass("text-app-text-muted");
    expect(icon).not.toHaveClass("text-white");
  });

  it("shows the '!' badge and its words, with a default, but not beside a count", () => {
    const { container, unmount } = renderLink({ hasAttentionMarker: true });
    expect(container.textContent).toContain("!");
    expect(screen.getByText("Needs attention")).toHaveClass("sr-only");
    unmount();

    const custom = renderLink({ hasAttentionMarker: true, attentionLabel: "Look here" });
    expect(screen.getByText("Look here")).toBeInTheDocument();
    custom.unmount();

    const counted = renderLink({ hasAttentionMarker: true, count: 3 });
    expect(counted.container.textContent).not.toContain("!");
    expect(screen.queryByText("Needs attention")).toBeNull();
  });
});

describe("SidebarNavLink — backdrop", () => {
  it("draws the brand pill when active and a hover tint otherwise", () => {
    const active = renderLink({}, ACTIVE);
    expect(active.container.querySelector(".bg-app-brand")).not.toBeNull();
    expect(active.container.querySelector(".bg-app-surface-hover")).toBeNull();
    expect(active.container.querySelector(".bg-app-brand-border-strong")).not.toBeNull();
    active.unmount();

    const idle = renderLink({});
    expect(idle.container.querySelector(".bg-app-surface-hover")).not.toBeNull();
    expect(idle.container.querySelector(".bg-app-brand")).toBeNull();
    expect(idle.container.querySelector(".ring-inset")).not.toBeNull();
  });

  it("forces the active look for a section parent", () => {
    const { container } = renderLink({ forceActive: true });
    expect(container.querySelector(".bg-app-brand")).not.toBeNull();
    expect(screen.getByRole("link")).toHaveClass("text-white");
  });

  it("falls back to plain CSS hover under reduced motion", () => {
    motion.reduced = true;
    const idle = renderLink({});
    expect(idle.container.querySelector(".group-hover\\:opacity-100")).not.toBeNull();
    idle.unmount();

    const active = renderLink({}, ACTIVE);
    expect(
      active.container.querySelector(".bg-app-brand-border-strong.group-hover\\:opacity-100"),
    ).not.toBeNull();
  });
});

describe("SidebarNavLink — folded tooltip", () => {
  const user = () => userEvent.setup();

  it("hides the label from sight but keeps it as the name", () => {
    renderLink({ collapsed: true });
    expect(screen.getByText("Escalation Inbox")).toHaveClass("sr-only");
  });

  it("shows the label beside the icon on hover and removes it on leave", async () => {
    renderLink({ collapsed: true });
    const row = screen.getByRole("link").parentElement as HTMLElement;
    expect(document.body.querySelector(".fixed")).toBeNull();

    fireEvent.pointerEnter(row);
    const tip = document.body.querySelector(".fixed") as HTMLElement;
    expect(tip).toHaveTextContent("Escalation Inbox");
    expect(tip).toHaveStyle({ left: "210px", top: "120px" });
    expect(tip).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerLeave(row);
    expect(document.body.querySelector(".fixed")).toBeNull();
    await user().keyboard("{Escape}");
  });

  it("never shows when open", () => {
    renderLink({});
    fireEvent.pointerEnter(screen.getByRole("link").parentElement as HTMLElement);
    expect(document.body.querySelector(".fixed")).toBeNull();
  });

  it("follows keyboard focus and goes on blur or Escape", async () => {
    renderLink({ collapsed: true });
    const link = screen.getByRole("link");

    await user().tab();
    expect(link).toHaveFocus();
    expect(document.body.querySelector(".fixed")).not.toBeNull();

    await user().keyboard("{Escape}");
    expect(document.body.querySelector(".fixed")).toBeNull();

    fireEvent.blur(link);
    fireEvent.focus(link);
    expect(document.body.querySelector(".fixed")).not.toBeNull();
    fireEvent.blur(link);
    expect(document.body.querySelector(".fixed")).toBeNull();
  });

  it("says what is busy, counted or needing attention under the name", () => {
    const row = () => screen.getByRole("link").parentElement as HTMLElement;
    const tipText = () => (document.body.querySelector(".fixed") as HTMLElement).textContent;

    const busy = renderLink({ collapsed: true, busy: true, busyLabel: "Building" });
    fireEvent.pointerEnter(row());
    expect(tipText()).toBe("Escalation InboxBuilding");
    busy.unmount();

    const counted = renderLink({ collapsed: true, count: 3, countLabel: (n) => `${n} open` });
    fireEvent.pointerEnter(row());
    expect(tipText()).toBe("Escalation Inbox3 open");
    counted.unmount();

    const flagged = renderLink({ collapsed: true, hasAttentionMarker: true });
    fireEvent.pointerEnter(row());
    expect(tipText()).toBe("Escalation InboxNeeds attention");
    flagged.unmount();

    renderLink({ collapsed: true });
    fireEvent.pointerEnter(row());
    expect(tipText()).toBe("Escalation Inbox");
  });
});

describe("SidebarNavLink — dock", () => {
  const rowStyle = () => (screen.getByRole("link").parentElement as HTMLElement).style.transform;

  it("lifts the entry under the pointer and lets it go again", async () => {
    renderLink({});
    expect(rowStyle()).not.toContain("scale(1.0");

    act(() => pointer!.set(120));
    await waitFor(() => expect(rowStyle()).toMatch(/scale\(1\.0[3-6]/));

    act(() => pointer!.set(Number.NEGATIVE_INFINITY));
    await waitFor(() => expect(rowStyle()).not.toMatch(/scale\(1\.0[1-9]/));
  });

  it("does not lift an entry the pointer is far from", async () => {
    renderLink({});
    act(() => pointer!.set(600));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(rowStyle()).not.toMatch(/scale\(1\.0[1-9]/);
  });

  it("lifts fully on keyboard focus", async () => {
    renderLink({});
    await userEvent.setup().tab();
    await waitFor(() => expect(rowStyle()).toMatch(/scale\(1\.05|scale\(1\.06/));
  });

  it("stays still under reduced motion", async () => {
    motion.reduced = true;
    renderLink({});
    act(() => pointer!.set(120));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(rowStyle()).not.toMatch(/scale\(1\.0[1-9]/);
  });

  it("re-measures when the window resizes", async () => {
    renderLink({});
    rectTop = 400;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await new Promise((resolve) => setTimeout(resolve, 60));

    act(() => pointer!.set(420));
    await waitFor(() => expect(rowStyle()).toMatch(/scale\(1\.0[3-6]/));
  });
});
