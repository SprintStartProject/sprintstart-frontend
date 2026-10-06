import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from "vitest";

// The chunk behind DinoGameLazy fails to arrive, the way a stale deploy's
// missing hashed file or a dropped connection does: the lazy import rejects.
vi.mock("../../../../src/features/easter-eggs/components/DinoGame", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

import { DinoGameLazy } from "../../../../src/features/easter-eggs/components/DinoGameLazy.tsx";

describe("DinoGameLazy when the game chunk fails to load", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    // React and the boundary both report the failure; keep the output clean.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("explains the failure inside the host surface instead of tearing it down", async () => {
    const onExit = vi.fn();
    render(<DinoGameLazy onExit={onExit} />);

    expect(await screen.findByText("Couldn't load Mini dino game")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Easter egg failed to load",
      expect.any(Error),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("closes from the keyboard too, not only from the button", async () => {
    const onExit = vi.fn();
    render(<DinoGameLazy onExit={onExit} />);
    await screen.findByText("Couldn't load Mini dino game");

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
