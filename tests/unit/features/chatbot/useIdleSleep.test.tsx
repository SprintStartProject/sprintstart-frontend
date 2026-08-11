import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useIdleSleep,
  DROWSY_MIN_MS,
  DROWSY_MAX_MS,
  ASLEEP_DELAY_MS,
} from "../../../../src/features/chatbot/hooks/useIdleSleep";

/**
 * The idle window is drawn at random per cycle, so most of these tests pin
 * `Math.random` to the low end and reason in terms of `DROWSY_MIN_MS`. Without
 * that, "advance to the maximum and expect drowsy" is a coin flip: a low draw
 * puts the bot to sleep well before the maximum elapses. The randomness itself
 * is covered by its own test at the bottom.
 */
describe("useIdleSleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Lets the zero-delay wake timer settle so the hook reaches its resting state. */
  const settle = () =>
    act(() => {
      vi.advanceTimersByTime(1);
    });

  it("starts awake and drifts off in two stages", () => {
    const { result } = renderHook(() => useIdleSleep());
    settle();
    expect(result.current.stage).toBe("awake");

    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS);
    });
    expect(result.current.stage).toBe("drowsy");

    act(() => {
      vi.advanceTimersByTime(ASLEEP_DELAY_MS);
    });
    expect(result.current.stage).toBe("asleep");
  });

  it("wakes on a keystroke and looks startled if it was asleep", () => {
    const { result } = renderHook(() => useIdleSleep());
    settle();

    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS + ASLEEP_DELAY_MS);
    });
    expect(result.current.stage).toBe("asleep");

    // Two separate acts on purpose: the state update from the event only
    // flushes when the first one exits, so the effect that schedules the
    // wake timer does not exist yet if the clock is advanced in the same block.
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    settle();

    expect(result.current.stage).toBe("awake");
    expect(result.current.isWaking).toBe(true);
  });

  it("does not look startled when it was merely drowsy", () => {
    const { result } = renderHook(() => useIdleSleep());
    settle();

    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS);
    });
    expect(result.current.stage).toBe("drowsy");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    settle();

    expect(result.current.stage).toBe("awake");
    expect(result.current.isWaking).toBe(false);
  });

  it("ignores pointer movement, so a nudged mouse cannot keep it up", () => {
    const { result } = renderHook(() => useIdleSleep());
    settle();

    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS + ASLEEP_DELAY_MS - 1000);
      document.dispatchEvent(new MouseEvent("pointermove"));
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.stage).toBe("asleep");
  });

  it("stays awake while it is busy, however long the user idles", () => {
    const { result } = renderHook(() => useIdleSleep({ enabled: false }));
    settle();

    act(() => {
      vi.advanceTimersByTime(DROWSY_MAX_MS * 3);
    });

    expect(result.current.stage).toBe("awake");
  });

  it("starts its countdown over once it stops being busy", () => {
    const { result, rerender } = renderHook(({ enabled }) => useIdleSleep({ enabled }), {
      initialProps: { enabled: false },
    });

    act(() => {
      vi.advanceTimersByTime(DROWSY_MAX_MS * 3);
    });
    expect(result.current.stage).toBe("awake");

    rerender({ enabled: true });
    settle();
    // A full countdown from here, not the leftover of the idle time spent
    // while the assistant was working.
    expect(result.current.stage).toBe("awake");

    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS);
    });
    expect(result.current.stage).toBe("drowsy");
  });

  it("draws its idle window from the configured range", () => {
    // Highest draw: still awake a hair before the maximum.
    vi.mocked(Math.random).mockReturnValue(0.999);
    const late = renderHook(() => useIdleSleep());
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.advanceTimersByTime(DROWSY_MAX_MS - 1000);
    });
    expect(late.result.current.stage).toBe("awake");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(late.result.current.stage).toBe("drowsy");

    // Lowest draw: not before the minimum either, so the floor holds.
    vi.mocked(Math.random).mockReturnValue(0);
    const early = renderHook(() => useIdleSleep());
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.advanceTimersByTime(DROWSY_MIN_MS - 1000);
    });
    expect(early.result.current.stage).toBe("awake");
  });
});
