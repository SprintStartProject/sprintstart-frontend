import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DinoPlayHint } from "../../../../src/features/easter-eggs/components/DinoPlayHint";

describe("DinoPlayHint", () => {
  it("is a phones-only tappable button that opens the game", () => {
    render(<DinoPlayHint onPlay={vi.fn()} />);

    const hint = screen.getByRole("button", { name: /pass the time/i });
    expect(hint).toHaveAttribute("data-testid", "dino-play-hint");
    // Hidden by default, shown on narrow viewports *or* on coarse pointers:
    // a phone in landscape is wider than `sm` and still has no Space key.
    // (jsdom has no media queries — these pin the classes, not the layout.)
    const classes = hint.className.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes).toContain("max-sm:flex");
    expect(classes).toContain("pointer-coarse:flex");
    expect(classes).not.toContain("sm:hidden");
    // A touch floor: on a phone this tap is the only way in, and the Space
    // key does not exist there. Focus comes from the app's one global
    // outline — a component must never hide it with `outline-none`.
    expect(classes).toContain("min-h-11");
    expect(hint.className).not.toContain("outline-none");
    expect(hint).toHaveTextContent("Pass the time");
    // No desktop copy left inside — the chip reads the same at every width.
    expect(hint).not.toHaveTextContent("Space");
  });

  it("opens the game on click — the tap path a keyboard-only trigger lacked", async () => {
    const onPlay = vi.fn();
    render(<DinoPlayHint onPlay={onPlay} />);

    await userEvent.click(screen.getByTestId("dino-play-hint"));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
