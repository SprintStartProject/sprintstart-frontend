import type { ComponentType } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// A registry whose only egg never arrives: the chunk stays unresolved, so the
// shell sits in exactly the window this test is about — the modal is open, no
// game has mounted, and nothing else can close it from the keyboard.
vi.mock("../../../../src/features/easter-eggs/registry", async () => {
  const { lazy } = await import("react");
  return {
    EGG_REGISTRY: {
      "space-invaders": {
        label: "Space Invaders game",
        kind: "canvas",
        component: lazy<ComponentType<{ onExit: () => void }>>(() => new Promise<never>(() => {})),
      },
    },
  };
});

import { EggModalShell } from "../../../../src/features/easter-eggs/components/EggModalShell";

describe("EggModalShell while the game chunk is still loading", () => {
  it("still closes on Escape, because the game that owns that key is not there yet", () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="space-invaders" open onClose={onClose} />);

    // Suspended: no canvas game, so no game-side Escape handler exists.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
