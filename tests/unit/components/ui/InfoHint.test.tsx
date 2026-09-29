import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoHint } from "../../../../src/components/ui/InfoHint";

describe("InfoHint", () => {
  it("opens the tooltip below the trigger by default", () => {
    render(<InfoHint text="Fills in the blanks." label="What this does" />);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("top-5");
    expect(tooltip.className).toContain("pt-2");
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
    expect(tooltip.className).toContain("pb-2");
    expect(tooltip.className).not.toContain("top-5");
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

  it("toggles on click, so a touch screen can open and dismiss it", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    const trigger = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    await user.click(trigger);
    expect(tooltip.className).toContain("opacity-100");

    await user.click(trigger);
    expect(tooltip.className).toContain("opacity-0");
  });

  it("closes when the pointer goes down outside of it", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    await user.click(screen.getByRole("button"));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("opacity-100");

    // A tap on inert background does not blur the trigger, so blur alone cannot dismiss it.
    fireEvent.pointerDown(document.body);
    expect(tooltip.className).toContain("opacity-0");
  });

  it("stays open when the pointer moves from the trigger onto the tooltip", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    const trigger = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    // Closed, the invisible bubble is inert so it never blocks what surrounds the trigger.
    expect(tooltip.className).toContain("pointer-events-none");

    await user.hover(trigger);
    expect(tooltip.className).toContain("opacity-100");
    expect(tooltip.className).toContain("pointer-events-auto");

    // SC 1.4.13: content revealed on hover must itself be hoverable.
    await user.hover(tooltip);
    expect(tooltip.className).toContain("opacity-100");

    await user.unhover(tooltip);
    expect(tooltip.className).toContain("opacity-0");
    expect(tooltip.className).toContain("pointer-events-none");
  });

  it("stays open when its own text is clicked", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    const trigger = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip");

    // Open it the touch way, then press the text to read or select it: focus moving from the
    // trigger onto the tooltip must not read as "left the hint".
    await user.click(trigger);
    expect(tooltip.className).toContain("opacity-100");

    await user.click(tooltip);
    expect(tooltip.className).toContain("opacity-100");
  });

  it("dismisses on Escape even when the trigger was only hovered", async () => {
    const user = userEvent.setup();
    render(<InfoHint text="Fills in the blanks." />);

    await user.hover(screen.getByRole("button"));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("opacity-100");

    // Focus is elsewhere — nothing on the trigger itself can hear this Escape.
    await user.keyboard("{Escape}");
    expect(tooltip.className).toContain("opacity-0");
  });
});
