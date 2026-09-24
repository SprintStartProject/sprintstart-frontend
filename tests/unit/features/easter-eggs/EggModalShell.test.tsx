import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EggModalShell } from "../../../../src/features/easter-eggs/components/EggModalShell.tsx";

// Both games are lazy-loaded, and these tests are about the shell: the header
// bar, the overlay click, the Escape handling and the `onExit` routing.
vi.mock("../../../../src/features/easter-eggs/components/SpaceInvaders", () => ({
  SpaceInvaders: ({ onExit }: { onExit: () => void }) => (
    <button onClick={onExit}>invaders-exit</button>
  ),
}));

// The stand-in focuses itself on mount, like the real frame does once its
// page has loaded — which is what could make a late-recording shell mistake
// the game for the opener.
vi.mock("../../../../src/features/easter-eggs/components/Game2048Frame", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    Game2048Frame: ({ onExit }: { onExit: () => void }) => {
      const ref = useRef<HTMLButtonElement>(null);
      useEffect(() => ref.current?.focus(), []);
      return (
        <button ref={ref} onClick={onExit}>
          frame-exit
        </button>
      );
    },
  };
});

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

  describe("focus contract", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function makeOpener(): HTMLButtonElement {
      const opener = document.createElement("button");
      opener.textContent = "opener";
      document.body.appendChild(opener);
      opener.focus();
      return opener;
    }

    it("moves focus into the dialog on open and back to the opener on close", async () => {
      const opener = makeOpener();
      const { rerender } = render(
        <EggModalShell eggId="space-invaders" open={false} onClose={vi.fn()} />,
      );
      rerender(<EggModalShell eggId="space-invaders" open onClose={vi.fn()} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
      await screen.findByText("invaders-exit");

      rerender(<EggModalShell eggId="space-invaders" open={false} onClose={vi.fn()} />);
      expect(document.activeElement).toBe(opener);
    });

    it("records the real opener even when the game focuses itself on a cached reopen", async () => {
      const opener = makeOpener();
      const { rerender } = render(<EggModalShell eggId="game-2048" open onClose={vi.fn()} />);
      await screen.findByText("frame-exit");
      rerender(<EggModalShell eggId="game-2048" open={false} onClose={vi.fn()} />);
      expect(document.activeElement).toBe(opener);

      // Second open: the chunk is cached, so the game mounts in the same
      // commit and focuses itself in its own effect.
      rerender(<EggModalShell eggId="game-2048" open onClose={vi.fn()} />);
      expect(document.activeElement).toBe(screen.getByText("frame-exit"));

      rerender(<EggModalShell eggId="game-2048" open={false} onClose={vi.fn()} />);
      expect(document.activeElement).toBe(opener);
    });

    it("does not try to restore focus to an opener that has left the document", async () => {
      const opener = makeOpener();
      const focusSpy = vi.spyOn(opener, "focus");
      const { rerender } = render(<EggModalShell eggId="space-invaders" open onClose={vi.fn()} />);
      await screen.findByText("invaders-exit");
      focusSpy.mockClear();

      opener.remove();
      rerender(<EggModalShell eggId="space-invaders" open={false} onClose={vi.fn()} />);
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it("wraps Tab and Shift+Tab inside the dialog", async () => {
      render(<EggModalShell eggId="game-2048" open onClose={vi.fn()} />);
      const close = screen.getByTestId("game-2048-close");
      const last = await screen.findByText("frame-exit");

      last.focus();
      fireEvent.keyDown(last, { key: "Tab" });
      expect(document.activeElement).toBe(close);

      fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(last);
    });

    it("pulls focus back when it lands on the page behind the overlay", async () => {
      const behind = document.createElement("button");
      behind.textContent = "behind";
      render(<EggModalShell eggId="game-2048" open onClose={vi.fn()} />);
      await screen.findByText("frame-exit");
      // After the dialog in document order, like tabbing out of the iframe's
      // last control: focus wraps to the first focusable.
      document.body.appendChild(behind);

      behind.focus();
      expect(document.activeElement).toBe(screen.getByTestId("game-2048-close"));
    });

    it("stops guarding focus once closed", async () => {
      const { rerender } = render(<EggModalShell eggId="game-2048" open onClose={vi.fn()} />);
      await screen.findByText("frame-exit");
      rerender(<EggModalShell eggId="game-2048" open={false} onClose={vi.fn()} />);

      const behind = document.createElement("button");
      document.body.appendChild(behind);
      behind.focus();
      expect(document.activeElement).toBe(behind);
    });
  });
});
