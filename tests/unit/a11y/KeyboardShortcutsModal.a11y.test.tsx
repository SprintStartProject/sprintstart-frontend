import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { KeyboardShortcutsModal } from "../../../src/features/shortcuts";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "user123",
      username: "Test User",
      email: "test@example.com",
      permissionGroup: "ADMIN",
      projectRoles: [],
      profileIcon: "Test",
    },
    logout: vi.fn(),
    status: "authenticated",
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    projects: [],
    selectedProject: null,
    selectedProjectId: "",
    canManageSelected: false,
    isSwitcherEnabled: true,
    isLoading: false,
    errorMessage: null,
    setSelectedProjectId: vi.fn(),
    reloadProjects: vi.fn(),
  }),
}));

function ShortcutsHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main>
      <button type="button" onClick={() => setIsOpen(true)}>
        Show shortcuts
      </button>
      <KeyboardShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </main>
  );
}

describe("Keyboard shortcuts help accessibility", () => {
  it("has no axe violations, keeps focus inside and gives it back on Escape", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<ShortcutsHarness />);

    const openButton = screen.getByRole("button", { name: "Show shortcuts" });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The chord list must be readable text: a help nobody can hear is not the help this
    // dialog exists to be (the hover hint is the one that stays `aria-hidden`).
    expect(within(dialog).getAllByText("Alt").length).toBeGreaterThan(0);

    expect(await axe(baseElement)).toHaveNoViolations();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });

  it("reaches the chord list for a keyboard-only reader", async () => {
    const user = userEvent.setup();
    render(<ShortcutsHarness />);

    await user.tab();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const closeButton = within(dialog).getByRole("button", { name: "Close dialog" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    expect(
      within(dialog).getByRole("heading", { level: 3, name: "Navigation" }),
    ).toBeInTheDocument();
  });
});
