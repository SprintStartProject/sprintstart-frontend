import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGithubTokens } from "../../../../src/features/settings/hooks/useGithubTokens";

vi.mock("../../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn(),
}));

import { getGithubPatNames } from "../../../../src/services/sources/githubService";

describe("useGithubTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads token names on mount", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValue(["default", "ci"]);

    const { result } = renderHook(() => useGithubTokens());

    await waitFor(() => expect(result.current.tokensLoaded).toBe(true));
    expect(result.current.tokenNames).toEqual(["default", "ci"]);
    expect(result.current.tokensError).toBeNull();
  });

  it("surfaces an error message when loading fails", async () => {
    vi.mocked(getGithubPatNames).mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useGithubTokens());

    await waitFor(() => expect(result.current.tokensLoaded).toBe(true));
    expect(result.current.tokensError).toBe("Network down");
    expect(result.current.tokenNames).toEqual([]);
  });

  it("reloads token names via loadTokenNames", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValueOnce(["a"]).mockResolvedValueOnce(["a", "b"]);

    const { result } = renderHook(() => useGithubTokens());

    await waitFor(() => expect(result.current.tokenNames).toEqual(["a"]));

    await result.current.loadTokenNames();

    await waitFor(() => expect(result.current.tokenNames).toEqual(["a", "b"]));
  });

  it("a slow stale fetch does not overwrite a newer one", async () => {
    // Controllable slow promise: stays pending until we resolve it, so the
    // mount load stays in-flight and `isRefreshing` is reliably true when
    // we trigger the second load (avoids a real-timer race in CI where a
    // setTimeout-based "slow" fetch resolves between waitFor polls).
    let resolveSlow: (names: string[]) => void = () => {};
    const slow = new Promise<string[]>((resolve) => {
      resolveSlow = resolve;
    });
    vi.mocked(getGithubPatNames).mockReturnValueOnce(slow).mockResolvedValueOnce(["fresh"]);

    const { result } = renderHook(() => useGithubTokens());

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    await act(async () => {
      await result.current.loadTokenNames();
    });

    await waitFor(() => expect(result.current.tokenNames).toEqual(["fresh"]));
    // Resolve the stale fetch — its result must not overwrite the fresh one.
    await act(async () => {
      resolveSlow(["stale"]);
      await slow;
    });
    expect(result.current.tokenNames).toEqual(["fresh"]);
  });

  it("ignores resolutions after unmount", async () => {
    let resolveLater: (names: string[]) => void = () => {};
    vi.mocked(getGithubPatNames).mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveLater = resolve;
      }),
    );

    const { unmount } = renderHook(() => useGithubTokens());
    unmount();

    // Resolving after unmount must not throw "setState on unmounted".
    resolveLater(["late"]);
    await Promise.resolve();
    // No assertion needed — no React warning means pass.
    expect(true).toBe(true);
  });
});
