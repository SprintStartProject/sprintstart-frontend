import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EggModalShell } from "../../../../src/features/easter-eggs/components/EggModalShell";

vi.mock("../../../../src/features/chatbot/components/DinoGame", () => ({
  DinoGame: ({ onExit }: { onExit: () => void }) => <button onClick={onExit}>dino-exit</button>,
}));

vi.mock("../../../../src/features/easter-eggs/components/Game2048Frame", () => ({
  Game2048Frame: ({ onExit }: { onExit: () => void }) => (
    <button onClick={onExit}>frame-exit</button>
  ),
}));

vi.mock("../../../../src/features/easter-eggs/components/SpaceInvaders", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../src/features/easter-eggs/components/SpaceInvaders")
  >("../../../../src/features/easter-eggs/components/SpaceInvaders");
  return actual;
});

describe("EggModalShell", () => {
  it("renders nothing when closed", () => {
    render(<EggModalShell eggId="dino" open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["dino", "Dino game"],
    ["game-2048", "2048"],
    ["space-invaders", "Space Invaders game"],
  ] as const)("renders %s with the right dialog label", (eggId, label) => {
    render(<EggModalShell eggId={eggId} open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: label })).toBeInTheDocument();
  });

  it("routes the game's onExit to onClose", () => {
    const onClose = vi.fn();
    render(<EggModalShell eggId="dino" open onClose={onClose} />);
    fireEvent.click(screen.getByText("dino-exit"));
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
