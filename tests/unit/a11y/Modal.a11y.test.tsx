import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Modal } from "../../../src/components/ui/Modal";

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      <a href="/outside">Outside link</a>
      <Modal
        isOpen={isOpen}
        title="Example Modal"
        description="This is a description"
        onClose={() => setIsOpen(false)}
        footer={<button type="button">Save</button>}
      >
        <button type="button">Inner action</button>
      </Modal>
    </main>
  );
}

describe("Modal Accessibility", () => {
  it("has no axe violations and keeps keyboard focus inside while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<ModalHarness />);

    const openButton = screen.getByRole("button", { name: "Open modal" });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Example Modal" });
    const closeButton = within(dialog).getByRole("button", { name: "Close dialog" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });
});
