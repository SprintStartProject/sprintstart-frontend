import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SpaceInvaders } from "../../../../src/features/easter-eggs/components/SpaceInvaders.tsx";

/**
 * Keyboard ownership of the Space Invaders game. The canvas loop itself is not
 * exercised (jsdom has no 2D context). `fireEvent` returns false when the
 * handler called `preventDefault`, which is how "the game took the key" shows.
 */
describe("SpaceInvaders keyboard", () => {
  it("takes the movement keys", () => {
    render(<SpaceInvaders onExit={vi.fn()} />);
    expect(fireEvent.keyDown(document.body, { key: "a", code: "KeyA" })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: "ArrowRight", code: "ArrowRight" })).toBe(false);
  });

  it("leaves modified presses to the browser, so Ctrl/Cmd+A still selects all", () => {
    render(<SpaceInvaders onExit={vi.fn()} />);
    expect(fireEvent.keyDown(document.body, { key: "a", code: "KeyA", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: "a", code: "KeyA", metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: "d", code: "KeyD", altKey: true })).toBe(true);
  });

  it("leaves keys typed into a text field alone", () => {
    render(
      <>
        <input aria-label="Message" />
        <SpaceInvaders onExit={vi.fn()} />
      </>,
    );
    const field = screen.getByLabelText("Message");
    expect(fireEvent.keyDown(field, { key: "a", code: "KeyA" })).toBe(true);
    expect(fireEvent.keyDown(field, { key: " ", code: "Space" })).toBe(true);
  });

  it("claims Escape before document listeners see it", () => {
    const onExit = vi.fn();
    const documentListener = vi.fn();
    document.addEventListener("keydown", documentListener);
    render(<SpaceInvaders onExit={onExit} />);

    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(documentListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", documentListener);
  });
});
