import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EggEffectsLayer } from "../../../../src/features/easter-eggs/components/EggEffectsLayer.tsx";
import {
  clearEggEffect,
  playEggEffect,
  useActiveEggEffect,
} from "../../../../src/features/easter-eggs/eggEffectBus.ts";

// jsdom only: no canvas implementation, and no rAF-driven pixel output to
// assert. These tests are about the layer's timing contract — when an effect
// is re-fired while it is still running, it gets its own full run instead of
// inheriting the deadline of the one before it.
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

const { useReducedMotion } = await import("framer-motion");
const mockReducedMotion = vi.mocked(useReducedMotion);

const ctxStub = {
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  fillText: () => {},
  setTransform: () => {},
  clearRect: () => {},
};

describe("EggEffectsLayer re-fires", () => {
  beforeEach(() => {
    clearEggEffect();
    document.body.classList.remove("barrel-roll-active");
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D,
    );
  });

  it("gives a second barrel roll its full spin", async () => {
    render(<EggEffectsLayer />);
    act(() => playEggEffect("barrel-roll"));
    expect(document.body.classList.contains("barrel-roll-active")).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });

    // Fired again just before the first roll's 2s timer: the clock starts over.
    act(() => playEggEffect("barrel-roll"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    // Past the first trigger's deadline — still spinning.
    expect(document.body.classList.contains("barrel-roll-active")).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    expect(document.body.classList.contains("barrel-roll-active")).toBe(false);
  });

  it("restarts the matrix rain instead of letting it end mid-fall", async () => {
    render(<EggEffectsLayer />);
    act(() => playEggEffect("matrix"));
    expect(document.querySelector("canvas")).not.toBeNull();

    // The rain ends itself 6s after it started; re-fire at 5s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    act(() => playEggEffect("matrix"));

    // 6.5s after the first trigger: the remount owns its own clock, so the
    // rain is still falling (keyed by seq — without the key the first
    // instance's timer would have torn it down here).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(document.querySelector("canvas")).not.toBeNull();
  });
});

describe("EggEffectsLayer under reduced motion", () => {
  beforeEach(() => {
    clearEggEffect();
    vi.useFakeTimers();
    mockReducedMotion.mockReturnValue(true);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctxStub as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    mockReducedMotion.mockReturnValue(false);
    vi.useRealTimers();
  });

  it("replaces the matrix rain with a static, announced chip that clears itself", async () => {
    let active: ReturnType<typeof useActiveEggEffect> = null;
    function Probe() {
      active = useActiveEggEffect();
      return null;
    }
    render(
      <>
        <EggEffectsLayer />
        <Probe />
      </>,
    );

    act(() => playEggEffect("matrix"));
    // Nothing that falls: no canvas at all.
    expect(document.querySelector("canvas")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/neo/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(active).toBeNull();
  });
});
