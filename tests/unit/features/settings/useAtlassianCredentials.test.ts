import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAtlassianCredentials } from "../../../../src/features/settings/hooks/useAtlassianCredentials";
import type { AtlassianCredentialDto } from "../../../../src/services/sources/atlassianService";

vi.mock("../../../../src/services/sources/atlassianService", () => ({
  getMyAtlassianCredentials: vi.fn(),
}));

import { getMyAtlassianCredentials } from "../../../../src/services/sources/atlassianService";

const cred = (displayName: string): AtlassianCredentialDto => ({
  userEmail: "a@b.com",
  displayName,
});

describe("useAtlassianCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated user's credentials on mount", async () => {
    vi.mocked(getMyAtlassianCredentials).mockResolvedValue([cred("default"), cred("ci")]);

    const { result } = renderHook(() => useAtlassianCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials.map((c) => c.displayName)).toEqual(["default", "ci"]);
    expect(result.current.error).toBeNull();
    expect(getMyAtlassianCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("settles into a loaded-empty state without fetching when disabled", async () => {
    const { result } = renderHook(() => useAtlassianCredentials(false));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials).toEqual([]);
    expect(getMyAtlassianCredentials).not.toHaveBeenCalled();
  });

  it("surfaces an error message when loading fails", async () => {
    vi.mocked(getMyAtlassianCredentials).mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useAtlassianCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe("Network down");
    expect(result.current.credentials).toEqual([]);
  });

  it("reloads credentials via reload", async () => {
    vi.mocked(getMyAtlassianCredentials)
      .mockResolvedValueOnce([cred("a")])
      .mockResolvedValueOnce([cred("a"), cred("b")]);

    const { result } = renderHook(() => useAtlassianCredentials());

    await waitFor(() =>
      expect(result.current.credentials.map((c) => c.displayName)).toEqual(["a"]),
    );

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() =>
      expect(result.current.credentials.map((c) => c.displayName)).toEqual(["a", "b"]),
    );
  });

  it("a slow stale fetch does not overwrite a newer one", async () => {
    let resolveSlow: (list: AtlassianCredentialDto[]) => void = () => {};
    const slow = new Promise<AtlassianCredentialDto[]>((resolve) => {
      resolveSlow = resolve;
    });
    vi.mocked(getMyAtlassianCredentials)
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce([cred("fresh")]);

    const { result } = renderHook(() => useAtlassianCredentials());

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() =>
      expect(result.current.credentials.map((c) => c.displayName)).toEqual(["fresh"]),
    );

    await act(async () => {
      resolveSlow([cred("stale")]);
      await slow;
    });
    expect(result.current.credentials.map((c) => c.displayName)).toEqual(["fresh"]);
  });
});
