import { act, render, screen, fireEvent } from "@testing-library/react";
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
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} isRunning />
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
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} isRunning />
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
          isRunning
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
        <GenerationScreen phases={mockPhases} startedAt={Date.now() - 5000} isRunning />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.queryByText(/reply ready/i)).not.toBeInTheDocument();

    // Rerender as completed
    rerender(
      <MemoryRouter>
        <GenerationScreen
          phases={mockPhases}
          startedAt={Date.now() - 5000}
          isRunning={false}
          isCompleted
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent(/path ready/i);
  });

  it("keeps generating while the run is in flight, even with every phase reported done", () => {
    // Last phase reported "Completed…" but the path is still being persisted: the run can still fail.
    window.localStorage.setItem("dinoUnlocked", "true");
    const allDone: GenerationPhaseProgress[] = mockPhases.map((phase) => ({
      ...phase,
      state: "done",
    }));
    render(
      <MemoryRouter>
        <GenerationScreen phases={allDone} startedAt={Date.now() - 5000} isRunning />
      </MemoryRouter>,
    );

    expect(screen.getByText(/to pass the time/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByRole("application", { name: /mini dino game/i })).toBeInTheDocument();
    expect(screen.queryByTestId("dino-game-reply-ready")).not.toBeInTheDocument();
  });

  it("shows no phase still working once completed, and stops the clock", () => {
    vi.useFakeTimers();
    try {
      const startedAt = Date.now() - 5000;
      render(
        <MemoryRouter>
          <GenerationScreen
            phases={mockPhases}
            startedAt={startedAt}
            isRunning={false}
            isCompleted
          />
        </MemoryRouter>,
      );

      for (const phase of screen.getAllByTestId("generation-phase")) {
        expect(phase).toHaveAttribute("data-state", "done");
      }
      expect(screen.getByText("3 of 3 phases assembled")).toBeInTheDocument();

      const elapsedBefore = screen.getByTestId("generation-elapsed").textContent;
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("generation-elapsed").textContent).toBe(elapsedBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a failed phase failed when completed", () => {
    render(
      <MemoryRouter>
        <GenerationScreen
          phases={[...mockPhases, { name: "Deep Dive", state: "failed", detail: "Nothing found" }]}
          startedAt={Date.now()}
          isRunning={false}
          isCompleted
        />
      </MemoryRouter>,
    );

    const states = screen
      .getAllByTestId("generation-phase")
      .map((phase) => phase.getAttribute("data-state"));
    expect(states).toEqual(["done", "done", "done", "failed"]);
  });
});
