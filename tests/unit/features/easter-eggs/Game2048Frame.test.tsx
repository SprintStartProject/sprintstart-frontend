import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Game2048Frame } from "../../../../src/features/easter-eggs/components/Game2048Frame.tsx";

function getFrame(): HTMLIFrameElement {
  return screen.getByTitle<HTMLIFrameElement>("2048 game");
}

function postFromSource(source: Window | null, origin = window.location.origin) {
  fireEvent(window, new MessageEvent("message", { data: { type: "EGG_EXIT" }, origin, source }));
}

describe("Game2048Frame", () => {
  it("renders the 2048 iframe", () => {
    render(<Game2048Frame onExit={vi.fn()} />);
    const iframe = getFrame();
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "/easter-eggs/2048.html");
  });

  it("calls onExit when its own game page reports EGG_EXIT", () => {
    const onExit = vi.fn();
    render(<Game2048Frame onExit={onExit} />);

    postFromSource(getFrame().contentWindow);

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ignores an EGG_EXIT report from another origin", () => {
    const onExit = vi.fn();
    render(<Game2048Frame onExit={onExit} />);

    postFromSource(getFrame().contentWindow, "https://somewhere-else.example");

    expect(onExit).not.toHaveBeenCalled();
  });

  it("ignores a same-origin EGG_EXIT that did not come from its own frame", () => {
    const onExit = vi.fn();
    render(<Game2048Frame onExit={onExit} />);

    postFromSource(window);
    postFromSource(null);

    expect(onExit).not.toHaveBeenCalled();
  });

  it("focuses the frame only once its page has loaded", () => {
    render(<Game2048Frame onExit={vi.fn()} />);
    const frameWindow = getFrame().contentWindow;
    expect(frameWindow).not.toBeNull();
    const focusSpy = vi.spyOn(frameWindow as Window, "focus");

    // The initial about:blank document is already "complete" — not a reason
    // to take focus.
    expect(focusSpy).not.toHaveBeenCalled();

    fireEvent.load(getFrame());
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
