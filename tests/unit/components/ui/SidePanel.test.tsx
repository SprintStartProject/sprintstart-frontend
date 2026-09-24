import { useState } from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { SidePanel } from "../../../../src/components/ui/SidePanel";

function SidePanelHarness({
  showOverlay = true,
  closeOnEscape = true,
  closeAriaLabel,
  title = "Test Panel",
  description,
  badge,
  leading,
  actions,
  footer,
  children,
}: {
  showOverlay?: boolean;
  closeOnEscape?: boolean;
  closeAriaLabel?: string;
  title?: string;
  description?: string;
  badge?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <SidePanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        description={description}
        badge={badge}
        leading={leading}
        actions={actions}
        footer={footer}
        showOverlay={showOverlay}
        closeOnEscape={closeOnEscape}
        closeAriaLabel={closeAriaLabel}
      >
        {children ?? <p>Panel content</p>}
      </SidePanel>
    </main>
  );
}

describe("SidePanel", () => {
  it("renders the dialog with aria-hidden and inert when closed", () => {
    render(<SidePanelHarness />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-hidden", "true");
    expect(dialog).toHaveAttribute("inert");
  });

  it("shows the dialog (aria-hidden=false, no inert) when open", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness />);
    const dialog = screen.getByRole("dialog", { hidden: true });

    await user.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(dialog).toHaveAttribute("aria-hidden", "false");
      expect(dialog).not.toHaveAttribute("inert");
    });
  });

  it("renders title, description, badge, leading, actions, and children", async () => {
    const user = userEvent.setup();
    render(
      <SidePanelHarness
        title="My Panel"
        description="Panel desc"
        badge={<span>Active</span>}
        leading={<span data-testid="leading-icon">L</span>}
        actions={<button type="button">Refresh</button>}
        footer={<button type="button">Save</button>}
      >
        <p>Body content</p>
      </SidePanelHarness>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "My Panel" });
    expect(within(dialog).getByText("Panel desc")).toBeInTheDocument();
    expect(within(dialog).getByText("Active")).toBeInTheDocument();
    expect(within(dialog).getByTestId("leading-icon")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(within(dialog).getByText("Body content")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("closes when the Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");
    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { hidden: true });
      expect(dialog).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("does not close on Escape when closeOnEscape is false", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness closeOnEscape={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-hidden", "false");
  });

  it("closes when the overlay is clicked", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { hidden: true });
    const overlay = Array.from(
      dialog.parentElement!.querySelectorAll('button[aria-label="Close details"]'),
    ).find((btn) => !dialog.contains(btn))!;
    await user.click(overlay);

    await waitFor(() => expect(dialog).toHaveAttribute("aria-hidden", "true"));
  });

  it("does not render an overlay button when showOverlay is false", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness showOverlay={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { hidden: true });
    const parent = dialog.parentElement!;
    const overlayCandidates = Array.from(
      parent.querySelectorAll('button[aria-label="Close details"]'),
    ).filter((btn) => !dialog.contains(btn));
    expect(overlayCandidates).toHaveLength(0);
  });

  it("uses a custom close aria label", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness closeAriaLabel="Dismiss panel" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("button", { name: "Dismiss panel" })).toBeInTheDocument();
  });

  it("restores focus to the opener button after closing", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness />);
    const openButton = screen.getByRole("button", { name: "Open" });
    await user.click(openButton);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(openButton).toHaveFocus());
  });

  it("calls onClose when the explicit close button is clicked", async () => {
    const user = userEvent.setup();
    render(<SidePanelHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { hidden: true });
    const closeBtn = within(dialog).getByRole("button", { name: "Close details" });
    await user.click(closeBtn);

    await waitFor(() => expect(dialog).toHaveAttribute("aria-hidden", "true"));
  });
});
