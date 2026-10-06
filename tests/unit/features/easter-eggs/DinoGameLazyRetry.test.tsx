import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from "vitest";

// The chunk fails once — a dropped connection — and then the network is back:
// the second import succeeds, the way a rebuilt `React.lazy` gives a retry a
// real new fetch instead of replaying the cached rejection.
let importCalls = 0;
vi.mock("../../../../src/features/easter-eggs/components/DinoGame", () => {
  importCalls += 1;
  if (importCalls === 1) {
    throw new Error("Failed to fetch dynamically imported module");
  }
  return {
    DinoGame: () => <div data-testid="dino-game-stub" />,
  };
});

import { DinoGameLazy } from "../../../../src/features/easter-eggs/components/DinoGameLazy.tsx";

describe("DinoGameLazy when a failed chunk load can recover", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    // The boundary logs the first failure; keep the output clean.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("tries a real new import on Try again and loads the game once the network is back", async () => {
    const onExit = vi.fn();
    render(<DinoGameLazy onExit={onExit} />);

    expect(await screen.findByText("Couldn't load Mini dino game")).toBeInTheDocument();
    expect(importCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("dino-game-stub")).toBeInTheDocument();
    expect(importCalls).toBe(2);
    expect(screen.queryByText("Couldn't load Mini dino game")).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
  });
});
