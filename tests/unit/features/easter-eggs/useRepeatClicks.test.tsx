import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRepeatClicks } from "../../../../src/features/easter-eggs/hooks/useRepeatClicks";

describe("useRepeatClicks", () => {
  it("fires only on the required consecutive click and resets", () => {
    const onReached = vi.fn();
    const { result } = renderHook(() => useRepeatClicks(3, onReached));

    result.current();
    result.current();
    expect(onReached).not.toHaveBeenCalled();

    result.current();
    expect(onReached).toHaveBeenCalledTimes(1);

    // Counter reset: two more clicks are not enough again.
    result.current();
    result.current();
    expect(onReached).toHaveBeenCalledTimes(1);
    result.current();
    expect(onReached).toHaveBeenCalledTimes(2);
  });

  it("keeps working when the callback identity changes between renders", () => {
    let counter = 0;
    const { result, rerender } = renderHook(() => useRepeatClicks(2, () => void counter++));

    result.current();
    rerender();
    result.current();
    expect(counter).toBe(1);
  });

  it("starts the count over when the clicks stop being consecutive", () => {
    const onReached = vi.fn();
    const { result } = renderHook(() => useRepeatClicks(3, onReached, 1000));

    const nowSpy = vi.spyOn(Date, "now");
    let clock = 0;
    nowSpy.mockImplementation(() => clock);

    try {
      result.current();
      result.current();

      // A pause longer than the window: the two clicks before it no longer
      // count towards the next gesture.
      clock = 1500;
      result.current();
      result.current();
      expect(onReached).not.toHaveBeenCalled();

      result.current();
      expect(onReached).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("defaults to one second per click, so a counted gesture still lands", () => {
    const onReached = vi.fn();
    const { result } = renderHook(() => useRepeatClicks(3, onReached));

    const nowSpy = vi.spyOn(Date, "now");
    let clock = 0;
    nowSpy.mockImplementation(() => clock);

    try {
      // ~800ms apart — unhurried, but unmistakably the gesture.
      for (const tick of [0, 800, 1600]) {
        clock = tick;
        result.current();
      }
      expect(onReached).toHaveBeenCalledTimes(1);

      // And the 3s budget still rules out accumulation: a click four seconds
      // after the last one starts a fresh count.
      clock = 5600;
      result.current();
      clock = 9000;
      result.current();
      clock = 12000;
      result.current();
      expect(onReached).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
