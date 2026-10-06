import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from "vitest";

// The chunk behind DinoGameLazy fails to arrive, the way a stale deploy's
// missing hashed file or a dropped connection does: the lazy import rejects.
// Every fresh import() runs this factory again — which is exactly what the
// retry below exercises.
let importCalls = 0;
vi.mock("../../../../src/features/easter-eggs/components/DinoGame", () => {
  importCalls += 1;
  throw new Error("Failed to fetch dynamically imported module");
});

import { DinoGameLazy } from "../../../../src/features/easter-eggs/components/DinoGameLazy.tsx";

describe("DinoGameLazy when the game chunk fails to load", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    // React and the boundary both report the failure; keep the output clean.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // Every mount pays one fresh import() — count them per test.
    importCalls = 0;
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

  it("claims Escape before an Escape-closable host sees it", async () => {
    const onExit = vi.fn();
    // A host like the summary drawer's SidePanel: it closes on Escape from a
    // document listener, which in the bubble phase runs before a plain window
    // listener would — the game's failure state must take the key first.
    const hostListener = vi.fn();
    document.addEventListener("keydown", hostListener);
    render(<DinoGameLazy onExit={onExit} />);
    await screen.findByText("Couldn't load Mini dino game");

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    // One press, one close: onExit fires, the host surface stays open.
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(hostListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", hostListener);
  });

  it("offers Try again, and a retry that fails again stays in the failure state", async () => {
    const onExit = vi.fn();
    render(<DinoGameLazy onExit={onExit} />);
    await screen.findByText("Couldn't load Mini dino game");
    expect(importCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // The retry is a real second import() — and it fails again here, so the
    // failure state holds instead of the game appearing.
    await waitFor(() => expect(importCalls).toBe(2));
    expect(await screen.findByText("Couldn't load Mini dino game")).toBeInTheDocument();
    expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });
});
