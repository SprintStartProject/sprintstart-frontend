import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { SidePanel } from "../../../src/components/ui/SidePanel";

function SidePanelHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open panel
      </button>
      <a href="/outside">Outside link</a>
      <SidePanel
        isOpen={isOpen}
        title="Example Panel"
        description="This is a description"
        onClose={() => setIsOpen(false)}
        footer={<button type="button">Apply</button>}
      >
        <button type="button">Panel action</button>
      </SidePanel>
    </main>
  );
}

describe("SidePanel Accessibility", () => {
  it("has no axe violations and traps/restores keyboard focus", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<SidePanelHarness />);

    const openButton = screen.getByRole("button", { name: "Open panel" });
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Example Panel" });
    const closeButton = within(dialog).getByRole("button", { name: "Close details" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Apply" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });
});
