import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFetch } from "../../../src/hooks/useFetch";

describe("useFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in the loading state with null data", () => {
    const loader = vi.fn().mockImplementation(() => new Promise<string>(() => {}));
    const { result } = renderHook(() => useFetch(loader, []));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);
  });

  it("sets data and clears loading on a successful load", async () => {
    const loader = vi.fn().mockResolvedValue("hello");
    const { result } = renderHook(() => useFetch(loader, []));

    await waitFor(() => expect(result.current.data).toBe("hello"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets the error flag when the loader rejects", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useFetch(loader, []));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("re-runs the loader when deps change and applies the new result", async () => {
    let value = 1;
    const loader = vi.fn().mockImplementation(() => Promise.resolve(value));
    const { result, rerender } = renderHook(({ dep }) => useFetch(loader, [dep]), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(result.current.data).toBe(1));

    value = 2;
    rerender({ dep: 2 });

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not re-run the loader when deps stay the same across re-renders", async () => {
    const loader = vi.fn().mockResolvedValue("stable");
    const { result, rerender } = renderHook(() => useFetch(loader, [1]));

    await waitFor(() => expect(result.current.data).toBe("stable"));
    expect(loader).toHaveBeenCalledTimes(1);

    rerender();
    await waitFor(() => expect(result.current.data).toBe("stable"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("ignores results from a superseded call (stale data protection)", async () => {
    let resolveFirst: (v: string) => void = () => {};
    let resolveSecond: (v: string) => void = () => {};
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });

    const loader = vi.fn();
    loader.mockReturnValueOnce(firstPromise);
    loader.mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook(({ dep }) => useFetch(loader, [dep]), {
      initialProps: { dep: "first" },
    });

    rerender({ dep: "second" });

    expect(loader).toHaveBeenCalledTimes(2);

    // Resolve the second (latest) call first.
    await act(async () => {
      resolveSecond("second-value");
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data).toBe("second-value"));

    // Now resolve the stale first call — it must not overwrite the latest result.
    await act(async () => {
      resolveFirst("stale-value");
      await Promise.resolve();
    });

    expect(result.current.data).toBe("second-value");
  });
});
