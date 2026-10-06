import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DinoPlayHint } from "../../../../src/features/easter-eggs/components/DinoPlayHint";

describe("DinoPlayHint", () => {
  it("is one tappable button that still names the Space key", () => {
    render(<DinoPlayHint onPlay={vi.fn()} />);

    const hint = screen.getByRole("button", { name: /pass the time/i });
    expect(hint).toHaveAttribute("data-testid", "dino-play-hint");
    // The shared focus ring, and a touch floor: on a phone this tap is the
    // only way in, and the Space key it names does not exist there.
    expect(hint.className).toContain("focus-visible:ring-app-focus");
    expect(hint.className).toContain("min-h-8");
    // The desktop copy; the touch copy lives in a `sm:hidden` span beside it.
    expect(screen.getByText(/to pass the time/i)).toBeInTheDocument();
    expect(hint).toHaveTextContent("Pass the time");
  });

  it("opens the game on click — the tap path a keyboard-only trigger lacked", async () => {
    const onPlay = vi.fn();
    render(<DinoPlayHint onPlay={onPlay} />);

    await userEvent.click(screen.getByTestId("dino-play-hint"));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
