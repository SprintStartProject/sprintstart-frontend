import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { GenerationScreen } from "../../../../../../src/features/onboarding/components/journey/GenerationScreen";
import type { GenerationPhaseProgress } from "../../../../../../src/features/onboarding/generation/OnboardingJourneyContext";

const mockPhases: GenerationPhaseProgress[] = [
  { name: "Orientation", state: "done", detail: "Ready" },
  { name: "Setup", state: "working", detail: "Configuring IDE" },
  { name: "First Task", state: "waiting", detail: "Queued" },
];

describe("GenerationScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders phases and assembling status", () => {
    render(
      <MemoryRouter>
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Building your onboarding path")).toBeInTheDocument();
    expect(screen.getByText("Orientation")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("First Task")).toBeInTheDocument();
  });

  it("does not show space hint or start game when dino is locked", () => {
    render(
      <MemoryRouter>
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/to pass the time/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.queryByRole("application", { name: /mini dino game/i })).not.toBeInTheDocument();
  });

  it("shows space hint when dino is unlocked and starts game on Space", () => {
    window.localStorage.setItem("dinoUnlocked", "true");
    const onGameActiveChange = vi.fn();

    render(
      <MemoryRouter>
        <GenerationScreen
          phases={mockPhases}
          startedAt={Date.now() - 5000}
          onGameActiveChange={onGameActiveChange}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/to pass the time/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "Space" });

    expect(screen.getByRole("application", { name: /mini dino game/i })).toBeInTheDocument();
    expect(onGameActiveChange).toHaveBeenCalledWith(true);
  });

  it("passes replyReady when isCompleted is true while game is active", () => {
    window.localStorage.setItem("dinoUnlocked", "true");

    const { rerender } = render(
      <MemoryRouter>
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} isCompleted={false} />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.queryByText(/reply ready/i)).not.toBeInTheDocument();

    // Rerender as completed
    rerender(
      <MemoryRouter>
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} isCompleted={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/path ready/i)).toBeInTheDocument();
  });
});
