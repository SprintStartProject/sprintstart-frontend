import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  playEggEffect,
  clearEggEffect,
  useActiveEggEffect,
} from "../../../../src/features/easter-eggs/eggEffectBus";
import { EggEffectsLayer } from "../../../../src/features/easter-eggs/components/EggEffectsLayer";

// The matrix canvas needs a real 2D context; stub it so the layer test can
// assert on the overlay itself.
vi.mock("../../../../src/features/easter-eggs/components/MatrixRain", () => ({
  MatrixRain: ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid="matrix-rain" onClick={onClose}>
      matrix
    </button>
  ),
}));

function Probe() {
  const effect = useActiveEggEffect();
  return <div data-testid="probe">{effect ? `${effect.id}:${effect.seq}` : "none"}</div>;
}

describe("eggEffectBus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearEggEffect();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.classList.remove("barrel-roll-active");
  });

  it("starts with no active effect and publishes fired ones", () => {
    render(
      <>
        <Probe />
        <EggEffectsLayer />
      </>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("none");

    act(() => {
      playEggEffect("barrel-roll");
    });
    expect(screen.getByTestId("probe")).toHaveTextContent(/^barrel-roll:\d+$/);
  });

  it("applies and cleans up the barrel-roll body class", () => {
    render(
      <>
        <Probe />
        <EggEffectsLayer />
      </>,
    );
    expect(document.body).not.toHaveClass("barrel-roll-active");

    act(() => {
      playEggEffect("barrel-roll");
    });
    expect(document.body).toHaveClass("barrel-roll-active");

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(document.body).not.toHaveClass("barrel-roll-active");
    expect(screen.getByTestId("probe")).toHaveTextContent("none");
  });

  it("renders MatrixRain for the matrix effect and closes it via its callback", () => {
    render(
      <>
        <Probe />
        <EggEffectsLayer />
      </>,
    );

    act(() => {
      playEggEffect("matrix");
    });
    expect(screen.getByTestId("matrix-rain")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("matrix-rain"));
    expect(screen.queryByTestId("matrix-rain")).not.toBeInTheDocument();
    expect(screen.getByTestId("probe")).toHaveTextContent("none");
  });

  it("clearing with nothing active is a no-op (does not notify)", () => {
    const probeSeqs: string[] = [];
    function Collecting() {
      const effect = useActiveEggEffect();
      probeSeqs.push(effect ? `${effect.id}` : "none");
      return null;
    }
    render(
      <>
        <Collecting />
        <EggEffectsLayer />
      </>,
    );

    act(() => {
      clearEggEffect();
    });
    // Only the initial mount render, no re-render for a no-op clear.
    expect(probeSeqs).toEqual(["none"]);
  });
});
