import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EggModalShell } from "../../../../src/features/easter-eggs/components/EggModalShell";

// Both games are lazy-loaded, and these tests are about the shell: the header
// bar, the overlay click, the Escape handling and the `onExit` routing.
vi.mock("../../../../src/features/easter-eggs/components/SpaceInvaders", () => ({
  SpaceInvaders: ({ onExit }: { onExit: () => void }) => (
    <button onClick={onExit}>invaders-exit</button>
  ),
}));

vi.mock("../../../../src/features/easter-eggs/components/Game2048Frame", () => ({
  Game2048Frame: ({ onExit }: { onExit: () => void }) => (
    <button onClick={onExit}>frame-exit</button>
  ),
}));

describe("EggModalShell", () => {
  it("renders nothing when closed", () => {
    render(<EggModalShell eggId="space-invaders" open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["game-2048", "2048"],
    ["space-invaders", "Space Invaders game"],
  ] as const)("renders %s with the right dialog label", (eggId, label) => {
    render(<EggModalShell eggId={eggId} open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: label })).toBeInTheDocument();
  });

  it("routes a canvas game's onExit to onClose", () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="space-invaders" open onClose={onClose} />);
    fireEvent.click(screen.getByText("invaders-exit"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="space-invaders" open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape for iframe games (2048)", () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="game-2048" open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
