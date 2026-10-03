import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "../../../../src/components/ui/Modal";
import { SidePanel } from "../../../../src/components/ui/SidePanel";

function DrawerWithDialog({ onClosePanel }: { onClosePanel: () => void }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <SidePanel isOpen onClose={onClosePanel} title="Drawer">
      <button type="button" onClick={() => setIsDialogOpen(true)}>
        Open dialog
      </button>
      <Modal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Confirm move">
        <button type="button">Confirm</button>
      </Modal>
    </SidePanel>
  );
}

// Kept apart from Modal.test.tsx, like SidePanel.escape.test.tsx: this covers the
// contract between a dialog and the drawer it was opened from.
describe("Modal Escape handling", () => {
  it("closes only the dialog, not the drawer behind it", async () => {
    const user = userEvent.setup();
    const onClosePanel = vi.fn();
    render(<DrawerWithDialog onClosePanel={onClosePanel} />);

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm move" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Confirm move" })).toBeNull());
    expect(onClosePanel).not.toHaveBeenCalled();
  });
});
