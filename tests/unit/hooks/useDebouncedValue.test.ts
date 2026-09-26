import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "../../../src/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("seed", 300));
    expect(result.current).toBe("seed");
  });

  it("only returns a new value after it has been stable for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    rerender({ value: "a" });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("a");
  });

  it("restarts the wait on every change and emits only the last value", () => {
    const seen: string[] = [];
    const { rerender } = renderHook(
      ({ value }) => {
        const debounced = useDebouncedValue(value, 300);
        seen.push(debounced);
        return debounced;
      },
      { initialProps: { value: "" } },
    );

    for (const value of ["r", "re", "rea", "read", "readm"]) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(new Set(seen)).toEqual(new Set(["", "readm"]));
  });

  it("drops a pending update on unmount", () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });
    rerender({ value: "late" });
    unmount();
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(300);
      }),
    ).not.toThrow();
  });
});
