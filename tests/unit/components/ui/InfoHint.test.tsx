import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoHint } from "../../../../src/components/ui/InfoHint";

describe("InfoHint", () => {
  it("opens the tooltip below the trigger by default", () => {
    render(<InfoHint text="Fills in the blanks." label="What this does" />);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("top-7");
    expect(tooltip.className).toContain("left-0");
    expect(screen.getByRole("button", { name: "What this does" })).toHaveAccessibleDescription(
      "Fills in the blanks.",
    );
  });

  it("opens above the trigger, right-aligned, in the top-end placement", () => {
    render(<InfoHint text="Fills in the blanks." placement="top-end" />);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("bottom-full");
    expect(tooltip.className).toContain("right-0");
    expect(tooltip.className).not.toContain("top-7");
  });

  it("shows on keyboard focus and dismisses on Escape", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("opacity-0");

    await user.tab();
    expect(tooltip.className).toContain("opacity-100");

    await user.keyboard("{Escape}");
    expect(tooltip.className).toContain("opacity-0");
  });
});
