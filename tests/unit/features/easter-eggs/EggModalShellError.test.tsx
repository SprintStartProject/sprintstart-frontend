import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// A registry whose chunks fail, the way a stale deploy's missing hashed file
// or a dropped connection does: the lazy import rejects.
vi.mock("../../../../src/features/easter-eggs/registry", async () => {
  const { lazy } = await import("react");
  const failing = () =>
    lazy<ComponentType<{ onExit: () => void }>>(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );
  return {
    EGG_REGISTRY: {
      "space-invaders": { label: "Space Invaders game", kind: "canvas", component: failing() },
      "game-2048": { label: "2048", kind: "iframe", component: failing() },
    },
  };
});

import { EggModalShell } from "../../../../src/features/easter-eggs/components/EggModalShell.tsx";

describe("EggModalShell when the game chunk fails to load", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    // React and the boundary both report the failure; keep the output clean.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("shows a friendly message instead of tearing down the app, and logs the error", async () => {
    render(<EggModalShell eggId="space-invaders" open onClose={vi.fn()} />);

    expect(await screen.findByText("Couldn't load Space Invaders game")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Easter egg failed to load",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("stays closable by button and by Escape for a canvas game", async () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="space-invaders" open onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps the iframe game's header close and fires Escape exactly once", async () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="game-2048" open onClose={onClose} />);

    expect(await screen.findByText("Couldn't load 2048")).toBeInTheDocument();
    // The header already closes; the failure state adds no second button.
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close 2048" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
