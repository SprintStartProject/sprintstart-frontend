import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidePanel } from "../../../../src/components/ui/SidePanel";

// Kept apart from SidePanel.test.tsx so this contract (a game inside the
// drawer owns Escape first) can evolve without colliding with edits there.
describe("SidePanel Escape handling", () => {
  it("ignores an Escape that an inner element already consumed via preventDefault", () => {
    const onClose = vi.fn();
    render(
      <SidePanel isOpen onClose={onClose} title="Test Panel">
        <input
          aria-label="Inner consumer"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </SidePanel>,
    );

    fireEvent.keyDown(screen.getByLabelText("Inner consumer"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
