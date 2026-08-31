import { act, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EggEffectsLayer } from "../../../../src/features/easter-eggs/components/EggEffectsLayer";
import { clearEggEffect, playEggEffect } from "../../../../src/features/easter-eggs/eggEffectBus";

// jsdom has no canvas implementation, so the rAF loop is a no-op there —
// these tests assert mount/unmount behavior and the reduced-motion path,
// not pixel output (same boundary the game tests use).
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

const { useReducedMotion } = await import("framer-motion");
const mockReducedMotion = vi.mocked(useReducedMotion);

// jsdom has no canvas implementation (getContext returns null), so the
// burst's rAF loop would exit before doing anything. Stub a minimal 2D
// context and fake rAF + performance so the whole lifecycle (spawn →
// simulate → fade → bus clear) runs deterministically under fake timers.
const ctxStub = {
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  setTransform: () => {},
  clearRect: () => {},
};

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctxStub as unknown as CanvasRenderingContext2D,
  );
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("ConfettiBurst (via EggEffectsLayer)", () => {
  beforeEach(() => {
    clearEggEffect();
    mockReducedMotion.mockReturnValue(false);
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts a pointer-events-none, aria-hidden canvas when party fires", () => {
    render(<EggEffectsLayer />);
    act(() => playEggEffect("party"));

    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.className).toContain("pointer-events-none");
  });

  it("clears the effect after the burst has finished", async () => {
    const { unmount } = render(<EggEffectsLayer />);
    act(() => playEggEffect("party"));
    expect(document.querySelector("canvas")).not.toBeNull();

    // Longest possible run: spawn window + max particle age + fade margin.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(document.querySelector("canvas")).toBeNull();
    unmount();
  });

  it("shows a static status chip instead of particles under reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<EggEffectsLayer />);

    act(() => playEggEffect("party"));

    expect(document.querySelector("canvas")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/party/i);
  });

  it("the reduced-motion chip also clears its bus effect", async () => {
    mockReducedMotion.mockReturnValue(true);
    render(<EggEffectsLayer />);

    act(() => playEggEffect("party"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
