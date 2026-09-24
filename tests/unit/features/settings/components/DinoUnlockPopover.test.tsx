import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DinoUnlockPopover } from "../../../../../src/features/settings/components/DinoUnlockPopover.tsx";

describe("DinoUnlockPopover", () => {
  it("keeps an empty status live region mounted while hidden", () => {
    render(<DinoUnlockPopover kind={null} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
    expect(screen.queryByTestId("dino-unlock-popover")).not.toBeInTheDocument();
  });

  it("updates the same live region's text instead of remounting it", () => {
    const { rerender } = render(<DinoUnlockPopover kind={null} />);
    const status = screen.getByRole("status");

    rerender(<DinoUnlockPopover kind="unlocked" />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("shh... press Space whenever you're waiting");

    rerender(<DinoUnlockPopover kind="locked" />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("you saw nothing...");
  });

  it("renders the unlock whisper with a kbd badge when kind is unlocked", () => {
    render(<DinoUnlockPopover kind="unlocked" />);

    const bubble = screen.getByTestId("dino-unlock-popover");
    expect(bubble).toHaveAttribute("data-kind", "unlocked");
    expect(bubble).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Space").tagName.toLowerCase()).toBe("kbd");
    expect(
      screen.getByText(/whenever you're waiting/i, { selector: "span.text-app-text-muted" }),
    ).toBeInTheDocument();
  });

  it("renders the lock whisper when kind is locked", () => {
    render(<DinoUnlockPopover kind="locked" />);

    expect(screen.getByTestId("dino-unlock-popover")).toHaveAttribute("data-kind", "locked");
    expect(screen.queryByText("Space")).not.toBeInTheDocument();
    expect(
      screen.getByText("you saw nothing...", { selector: "span:not([role])" }),
    ).toBeInTheDocument();
  });

  it("hides the decorative emoji from assistive tech", () => {
    const { rerender } = render(<DinoUnlockPopover kind="unlocked" />);
    expect(screen.getByTestId("dino-unlock-emoji")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    rerender(<DinoUnlockPopover kind="locked" />);
    expect(screen.getByTestId("dino-unlock-emoji")).toHaveAttribute("aria-hidden", "true");
  });
});
