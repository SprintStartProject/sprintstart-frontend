import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "../../../../src/components/ui/Modal";

/**
 * The project switcher lives inside the sidebar, whose wrapper uses
 * `position: sticky` and therefore creates a stacking context. A dialog rendered
 * inside it would be capped below page content using a positive z-index, no
 * matter how high its own z-index is. Portalling to <body> is what prevents
 * that, so it is pinned here.
 */
describe("Modal portalling", () => {
  it("renders into document.body rather than the caller subtree", () => {
    const { container } = render(
      <div style={{ position: "sticky" }} data-testid="stacking-context">
        <Modal isOpen title="Switch project" onClose={vi.fn()}>
          <p>Body content</p>
        </Modal>
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Switch project" });

    expect(dialog).toBeInTheDocument();
    // Not nested inside the sticky wrapper that would trap it.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("removes the portalled content when closed", () => {
    const { rerender } = render(
      <Modal isOpen title="Switch project" onClose={vi.fn()}>
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <Modal isOpen={false} title="Switch project" onClose={vi.fn()}>
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
