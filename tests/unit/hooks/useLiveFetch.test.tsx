import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLiveFetch } from "../../../src/hooks/useLiveFetch";

/** Puts the document into the given visibility state for the whole test. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useLiveFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the loading state with null data", () => {
    const loader = vi.fn().mockImplementation(() => new Promise<string>(() => {}));
    const { result } = renderHook(() => useLiveFetch(["live-fetch", "pending"], loader));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);
  });

  it("sets data and clears loading on a successful load", async () => {
    const loader = vi.fn().mockResolvedValue("hello");
    const { result } = renderHook(() => useLiveFetch(["live-fetch", "success"], loader));

    await waitFor(() => expect(result.current.data).toBe("hello"));
    expect(result.current.loading).toBe(false);
    expect(result.current.revalidating).toBe(false);
  });

  it("reports failure of the first load, which has nothing to fall back on", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLiveFetch(["live-fetch", "error"], loader));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("re-fetches when the query key changes and applies the new result", async () => {
    let value = 1;
    const loader = vi.fn().mockImplementation(() => Promise.resolve(value));
    const { result, rerender } = renderHook(
      ({ dep }) => useLiveFetch(["live-fetch", "key-change", dep], loader),
      { initialProps: { dep: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe(1));

    value = 2;
    rerender({ dep: 2 });

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("starts fresh rather than keeping the previous key's data on screen", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("project-a")
      .mockImplementation(() => new Promise<string>(() => {}));
    const { result, rerender } = renderHook(
      ({ dep }) => useLiveFetch(["live-fetch", "clears", dep], loader),
      { initialProps: { dep: "a" } },
    );

    await waitFor(() => expect(result.current.data).toBe("project-a"));

    rerender({ dep: "b" });

    // Keeping it would show one project's questions under another's name —
    // wrong, not merely stale.
    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it("does not re-fetch when the query key stays the same across re-renders", async () => {
    const loader = vi.fn().mockResolvedValue("stable");
    const { result, rerender } = renderHook(() => useLiveFetch(["live-fetch", "stable"], loader));

    await waitFor(() => expect(result.current.data).toBe("stable"));

    rerender();
    await waitFor(() => expect(result.current.data).toBe("stable"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keeps the data on screen while reloading it", async () => {
    let resolveSecond: (v: string) => void = () => {};
    const loader = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = renderHook(() =>
      useLiveFetch(["live-fetch", "refresh"], loader, { minIntervalMs: 0 }),
    );
    await waitFor(() => expect(result.current.data).toBe("first"));

    act(() => result.current.refresh());

    // A panel that refreshes every 30 seconds must not blink through a spinner
    // every 30 seconds.
    await waitFor(() => expect(result.current.revalidating).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe("first");

    await act(async () => {
      resolveSecond("second");
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data).toBe("second"));
  });

  it("keeps the last good data when a reload fails", async () => {
    const loader = vi.fn().mockResolvedValueOnce("good").mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useLiveFetch(["live-fetch", "reload-fails"], loader, { minIntervalMs: 0 }),
    );
    await waitFor(() => expect(result.current.data).toBe("good"));

    await act(async () => {
      result.current.refresh();
      await Promise.resolve();
    });

    // The next attempt is seconds away; an error screen would be a worse thing
    // to show than data that is a few seconds old.
    await waitFor(() => expect(result.current.revalidating).toBe(false));
    expect(result.current.error).toBe(false);
    expect(result.current.data).toBe("good");
  });

  it("does not load at all while disabled", async () => {
    const loader = vi.fn().mockResolvedValue("value");
    const { result } = renderHook(() =>
      useLiveFetch(["live-fetch", "disabled"], loader, { enabled: false }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loader).not.toHaveBeenCalled();
  });

  it("polls a visible tab on the configured interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const loader = vi.fn().mockResolvedValue("value");
    const { result } = renderHook(() =>
      useLiveFetch(["live-fetch", "interval"], loader, { intervalMs: 1000, minIntervalMs: 0 }),
    );
    await waitFor(() => expect(result.current.data).toBe("value"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(loader.mock.calls.length).toBeGreaterThan(1);
  });
});
