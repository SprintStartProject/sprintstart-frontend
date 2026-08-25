import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BuddyLauncher } from "../../../../src/features/buddy/components/BuddyLauncher";

function renderLauncher({ isOpen = false }: { isOpen?: boolean } = {}) {
  const onToggle = vi.fn();
  const onOpenFull = vi.fn();

  render(<BuddyLauncher isOpen={isOpen} onToggle={onToggle} onOpenFull={onOpenFull} />);

  return { onToggle, onOpenFull };
}

/**
 * One click opens the dock, two open the full page — which is only possible if a single click
 * waits out the double-click window before it commits. `onDoubleClick` alone would not do it:
 * the browser fires the two `click`s first, so the dock would open and the page would then
 * navigate out from under it. These pin that the second click really does cancel the first.
 */
describe("BuddyLauncher", () => {
  it("opens the dock on a single click", async () => {
    const user = userEvent.setup();
    const { onToggle, onOpenFull } = renderLauncher();

    await user.click(screen.getByRole("button", { name: "Open buddy chat" }));

    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1));
    expect(onOpenFull).not.toHaveBeenCalled();
  });

  it("opens the full page on a double click, without also opening the dock", async () => {
    const user = userEvent.setup();
    const { onToggle, onOpenFull } = renderLauncher();

    await user.dblClick(screen.getByRole("button", { name: "Open buddy chat" }));

    expect(onOpenFull).toHaveBeenCalledTimes(1);
    // Cancelled synchronously by the second click, so there is no window in which this could
    // still fire — no waiting needed to prove it.
    expect(onToggle).not.toHaveBeenCalled();
  });

  /** No second press to wait for, so a keyboard user gets no delay. */
  it("toggles immediately on Enter", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderLauncher();

    screen.getByRole("button", { name: "Open buddy chat" }).focus();
    await user.keyboard("{Enter}");

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  /** While the dock is open the launcher is its minimise control — same spot, same target. */
  it("becomes the minimise control while the dock is open", () => {
    renderLauncher({ isOpen: true });

    const button = screen.getByRole("button", { name: "Close buddy chat" });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
