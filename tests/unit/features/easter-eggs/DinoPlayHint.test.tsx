import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DinoPlayHint } from "../../../../src/features/easter-eggs/components/DinoPlayHint";

describe("DinoPlayHint", () => {
  it("is a phones-only tappable button that opens the game", () => {
    render(<DinoPlayHint onPlay={vi.fn()} />);

    const hint = screen.getByRole("button", { name: /pass the time/i });
    expect(hint).toHaveAttribute("data-testid", "dino-play-hint");
    // Phones only: on anything wider the Space key is the way in, and the
    // hint must not show there at all.
    expect(hint.className).toContain("sm:hidden");
    // The shared focus ring, and a touch floor: on a phone this tap is the
    // only way in, and the Space key does not exist there.
    expect(hint.className).toContain("focus-visible:ring-app-focus");
    expect(hint.className).toContain("min-h-8");
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
