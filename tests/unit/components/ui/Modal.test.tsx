import { useState } from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Modal } from "../../../../src/components/ui/Modal";

function ModalHarness({
  closeOnBackdrop = true,
  closeOnEscape = true,
  isDismissDisabled = false,
  role = "dialog",
  size = "md",
  description = "A description",
  title = "Test Modal",
  children,
  footer,
}: {
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  isDismissDisabled?: boolean;
  role?: "dialog" | "alertdialog";
  size?: "sm" | "md" | "lg" | "xl";
  description?: string;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <Modal
        isOpen={isOpen}
        title={title}
        description={description}
        onClose={() => setIsOpen(false)}
        closeOnBackdrop={closeOnBackdrop}
        closeOnEscape={closeOnEscape}
        isDismissDisabled={isDismissDisabled}
        role={role}
        size={size}
        footer={footer}
      >
        {children}
      </Modal>
    </main>
  );
}

describe("Modal", () => {
  it("does not render anything when closed", () => {
    render(<ModalHarness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the title and description when open", async () => {
    const user = userEvent.setup();
    render(<ModalHarness title="My Modal" description="Some details" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "My Modal" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Some details")).toBeInTheDocument();
  });

  it("closes when the Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not close on Escape when closeOnEscape is false", async () => {
    const user = userEvent.setup();
    render(<ModalHarness closeOnEscape={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not close on Escape when isDismissDisabled is true", async () => {
    const user = userEvent.setup();
    render(<ModalHarness isDismissDisabled />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    const backdrop = Array.from(
      dialog.parentElement!.querySelectorAll('button[aria-label="Close dialog"]'),
    ).find((btn) => !dialog.contains(btn))!;
    await user.click(backdrop);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not render a backdrop button when closeOnBackdrop is false", async () => {
    const user = userEvent.setup();
    render(<ModalHarness closeOnBackdrop={false} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    const parent = dialog.parentElement!;
    const backdropCandidates = Array.from(parent.children).filter(
      (child) => child !== dialog && child.tagName === "BUTTON",
    );
    expect(backdropCandidates).toHaveLength(0);
  });

  it("disables the close button when isDismissDisabled is true", async () => {
    const user = userEvent.setup();
    render(<ModalHarness isDismissDisabled />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    const closeButtons = within(dialog).getAllByRole("button", { name: "Close dialog" });
    for (const btn of closeButtons) {
      expect(btn).toBeDisabled();
    }
  });

  it("restores focus to the opener button after closing", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const openButton = screen.getByRole("button", { name: "Open" });
    await user.click(openButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });

  it('renders with role="alertdialog" when specified', async () => {
    const user = userEvent.setup();
    render(<ModalHarness role="alertdialog" title="Danger!" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("alertdialog", { name: "Danger!" })).toBeInTheDocument();
  });

  it("renders children and footer content", async () => {
    const user = userEvent.setup();
    render(
      <ModalHarness footer={<button type="button">Confirm</button>}>
        <p>Body text</p>
      </ModalHarness>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Body text")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("does not set aria-describedby when description is omitted", async () => {
    const user = userEvent.setup();
    render(<ModalHarness description="" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-describedby");
  });

  it("applies the correct max-width class for each size", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ModalHarness size="sm" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    let dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-w-sm");

    rerender(<ModalHarness size="xl" />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-w-4xl");
  });

  it("calls onClose when the explicit close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog");
    const closeBtn = within(dialog).getByRole("button", { name: "Close dialog" });
    await user.click(closeBtn);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
