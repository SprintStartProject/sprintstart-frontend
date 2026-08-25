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
});
