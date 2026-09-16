import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EggEffectsLayer } from "../../../../src/features/easter-eggs/components/EggEffectsLayer";
import { clearEggEffect, playEggEffect } from "../../../../src/features/easter-eggs/eggEffectBus";

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
