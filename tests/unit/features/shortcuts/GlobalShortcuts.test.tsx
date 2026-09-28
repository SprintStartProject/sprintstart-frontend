import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { GlobalShortcuts } from "../../../../src/features/shortcuts";
import * as useAuthHook from "../../../../src/context/useAuth";
import { PermissionGroup, type UserProfile } from "../../../../src/services/types";

const { projectState } = vi.hoisted(() => ({ projectState: { canManageSelected: false } }));

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue } = await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({ canManageSelected: projectState.canManageSelected }),
  };
});

vi.mock("../../../../src/context/useAuth", () => ({ useAuth: vi.fn() }));

const hireProfile: UserProfile = {
  id: "1",
  authId: "auth",
  username: "Hire",
  email: "hire@example.com",
  firstName: "Test",
  lastName: "Hire",
  projectRoles: [],
  projectIds: [],
  permissionGroup: PermissionGroup.USER,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: true,
};

function signIn(profile: UserProfile | null) {
  vi.mocked(useAuthHook.useAuth).mockReturnValue({
    status: profile ? "authenticated" : "unauthenticated",
    profile,
    login: vi.fn(),
    logout: vi.fn(),
    refetchProfile: vi.fn(),
  });
}

function LocationProbe() {
  const { pathname } = useLocation();

  return <span data-testid="pathname">{pathname}</span>;
}

function Harness({
  children,
  dialog,
}: {
  children?: ReactNode;
  /**
   * A stand-in overlay. `"modal"` is how `ui/Modal` and the canvas covers announce
   * themselves; `"popover"` is the buddy dock and the popup-style dialogs, which are
   * deliberately non-modal — the difference is the whole point of the global layer's guard.
   */
  dialog?: "modal" | "popover";
}) {
  return (
    <MemoryRouter initialEntries={["/board"]}>
      <GlobalShortcuts />
      <LocationProbe />
      {dialog === "modal" && <div role="dialog" aria-modal="true" aria-label="Another dialog" />}
      {dialog === "popover" && <div role="dialog" aria-label="Another dialog" />}
      {children}
    </MemoryRouter>
  );
}

/** Where the router currently is — the observable a navigation chord must move. */
function pathname(): string {
  return screen.getByTestId("pathname").textContent ?? "";
}

describe("GlobalShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectState.canManageSelected = false;
    signIn(hireProfile);
  });

  it("navigates to every destination the registry names", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const destinations: ReadonlyArray<readonly [string, string]> = [
      ["{Alt>}h{/Alt}", "/"],
      ["{Alt>}b{/Alt}", "/board"],
      ["{Alt>}c{/Alt}", "/chat"],
      ["{Alt>}u{/Alt}", "/buddy"],
      ["{Alt>}k{/Alt}", "/knowledge-base"],
      // Character-matched, and typed as a character: the comma is what somebody presses,
      // whatever their layout does with Shift to produce it.
      ["{Alt>},{/Alt}", "/settings"],
    ];

    for (const [keys, path] of destinations) {
      await user.keyboard(keys);

      expect(pathname()).toBe(path);
    }
  });

  it("refuses the PM dashboard to a hire", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Alt>}p{/Alt}");

    expect(pathname()).toBe("/board");
  });

  it("lets a PM managing the selected project through", async () => {
    projectState.canManageSelected = true;
    signIn({ ...hireProfile, permissionGroup: PermissionGroup.PM });
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Alt>}p{/Alt}");

    expect(pathname()).toBe("/pm-dashboard");
  });

  it("does nothing while a text field has the keys", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <input aria-label="Message" />
      </Harness>,
    );

    await user.click(screen.getByRole("textbox", { name: "Message" }));
    await user.keyboard("{Alt>}k{/Alt}");

    expect(pathname()).toBe("/board");
  });

  it("refuses Ctrl+Alt, the pair Windows reports for AltGr", () => {
    render(<Harness />);

    fireEvent.keyDown(window, { code: "KeyB", altKey: true, ctrlKey: true });

    expect(pathname()).toBe("/board");
  });

  it("ignores a held chord repeating", () => {
    render(<Harness />);

    fireEvent.keyDown(window, { code: "KeyB", altKey: true, repeat: true });

    expect(pathname()).toBe("/board");
  });

  it("does nothing at all without a profile", async () => {
    signIn(null);
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("{Alt>}h{/Alt}");

    expect(pathname()).toBe("/board");
  });

  it("opens the help on ? and closes it again on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument(),
    );
  });

  it("keeps the help single while it is already open", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard("?");
    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    await user.keyboard("?");

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("leaves the keyboard to a modal surface while one is up", async () => {
    const user = userEvent.setup();
    render(<Harness dialog="modal" />);

    await user.keyboard("{Alt>}h{/Alt}");
    expect(pathname()).toBe("/board");

    await user.keyboard("?");

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    // Only the stand-in is on screen — one Escape, one dialog, as it should stay.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("still navigates when the open overlay is a non-modal popover", async () => {
    // The buddy dock and the popover-style dialogs are `role="dialog"` without `aria-modal`,
    // on purpose: treating them as keyboard owners would freeze every chord while they sit
    // open — which, with the dock, is most of a working session.
    const user = userEvent.setup();
    render(<Harness dialog="popover" />);

    await user.keyboard("{Alt>}k{/Alt}");

    expect(pathname()).toBe("/knowledge-base");
  });

  it("consumes a denied chord instead of handing it to the browser", () => {
    render(<Harness />);

    // `fireEvent` resolves to `!event.defaultPrevented`, so a consumed chord comes back
    // `false` — the observable for "the app owns Alt+P even when this profile may not use it".
    expect(fireEvent.keyDown(window, { code: "KeyP", altKey: true })).toBe(false);
    expect(pathname()).toBe("/board");
  });
});
