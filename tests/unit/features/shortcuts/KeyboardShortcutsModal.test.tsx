import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcutsModal } from "../../../../src/features/shortcuts";
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

function renderModal(isOpen = true) {
  return render(<KeyboardShortcutsModal isOpen={isOpen} onClose={vi.fn()} />);
}

/**
 * The list row a label belongs to — the chord's own unit. Queried by role rather than text
 * because "Keyboard shortcuts" is both a row and the dialog's own heading.
 */
function rowFor(label: string): HTMLElement {
  const row = screen.getAllByRole("listitem").find((item) => item.textContent?.startsWith(label));

  if (!row) throw new Error(`No row for "${label}"`);
  return row;
}

describe("KeyboardShortcutsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectState.canManageSelected = false;
    signIn(hireProfile);
  });

  it("renders nothing while it is closed", () => {
    renderModal(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("groups the chords under the three headings", () => {
    renderModal();

    expect(screen.getByRole("heading", { level: 3, name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "General" })).toBeInTheDocument();
  });

  it("lists every destination a hire may reach, and none of the others", () => {
    renderModal();

    for (const label of ["Dashboard", "Board", "Chat", "Buddy", "Knowledge Base", "Settings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.queryByText("PM Dashboard")).not.toBeInTheDocument();
  });

  it("advertises the PM dashboard to a PM managing the selected project", () => {
    projectState.canManageSelected = true;
    signIn({ ...hireProfile, permissionGroup: PermissionGroup.PM });

    renderModal();

    expect(screen.getByText("PM Dashboard")).toBeInTheDocument();
  });

  it("prints a chord one key cap at a time", () => {
    renderModal();

    const dashboard = within(rowFor("Dashboard"));
    expect(dashboard.getByText("Alt")).toBeInTheDocument();
    expect(dashboard.getByText("H")).toBeInTheDocument();

    // The one chord with a platform split, so it must not be hardcoded to Alt anywhere.
    const switcher = within(rowFor("Switch project"));
    expect(switcher.getByText("Ctrl")).toBeInTheDocument();
    expect(switcher.getByText("K")).toBeInTheDocument();

    // Characters stay whole: splitting "?" or "Esc" on " + " must not cut them apart.
    expect(within(rowFor("Keyboard shortcuts")).getByText("?")).toBeInTheDocument();
    expect(within(rowFor("Close a dialog or menu")).getByText("Esc")).toBeInTheDocument();
    expect(within(rowFor("Settings")).getByText(",")).toBeInTheDocument();
  });

  it("says where a chord only works somewhere specific", () => {
    renderModal();

    expect(within(rowFor("Jump to the message box")).getByText(/in Chat/)).toBeInTheDocument();
  });

  it("documents the chords the surfaces answer, not only the global ones", () => {
    renderModal();

    // These belong to the switcher, the chat surfaces, the sidebar and the dialogs — their
    // owners listen, but the help is the one place a person can learn they exist.
    for (const label of [
      "Switch project",
      "New conversation",
      "Toggle sidebar",
      "Close a dialog or menu",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
