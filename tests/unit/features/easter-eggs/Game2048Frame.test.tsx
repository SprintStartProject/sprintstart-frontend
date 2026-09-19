import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Game2048Frame } from "../../../../src/features/easter-eggs/components/Game2048Frame";

describe("Game2048Frame", () => {
  it("renders the 2048 iframe", () => {
    render(<Game2048Frame onExit={vi.fn()} />);
    const iframe = screen.getByTitle("2048 game");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "/easter-eggs/2048.html");
  });

  it("calls onExit when the game page reports EGG_EXIT", () => {
    const onExit = vi.fn();
    render(<Game2048Frame onExit={onExit} />);

    fireEvent(
      window,
      new MessageEvent("message", {
        data: { type: "EGG_EXIT" },
        origin: window.location.origin,
      }),
    );

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ignores an EGG_EXIT report from another origin", () => {
    const onExit = vi.fn();
    render(<Game2048Frame onExit={onExit} />);

    fireEvent(
      window,
      new MessageEvent("message", {
        data: { type: "EGG_EXIT" },
        origin: "https://somewhere-else.example",
      }),
    );

    expect(onExit).not.toHaveBeenCalled();
  });
});
