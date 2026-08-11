import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useJiraCredentials } from "../../../../src/features/settings/hooks/useJiraCredentials";
import type { JiraCredentialsDto } from "../../../../src/services/sources/jiraService";

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
}));

import { getMyJiraCredentials } from "../../../../src/services/sources/jiraService";

const cred = (displayName: string): JiraCredentialsDto => ({
  userEmail: "a@b.com",
  displayName,
});

describe("useJiraCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated user's credentials on mount", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([cred("default"), cred("ci")]);

    const { result } = renderHook(() => useJiraCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials.map((c) => c.displayName)).toEqual(["default", "ci"]);
    expect(result.current.error).toBeNull();
    expect(getMyJiraCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("settles into a loaded-empty state without fetching when disabled", async () => {
    const { result } = renderHook(() => useJiraCredentials(false));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials).toEqual([]);
    expect(getMyJiraCredentials).not.toHaveBeenCalled();
  });

  it("surfaces an error message when loading fails", async () => {
    vi.mocked(getMyJiraCredentials).mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useJiraCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe("Network down");
    expect(result.current.credentials).toEqual([]);
  });

  it("reloads credentials via reload", async () => {
    vi.mocked(getMyJiraCredentials)
      .mockResolvedValueOnce([cred("a")])
      .mockResolvedValueOnce([cred("a"), cred("b")]);

    const { result } = renderHook(() => useJiraCredentials());

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
    let resolveSlow: (list: JiraCredentialsDto[]) => void = () => {};
    const slow = new Promise<JiraCredentialsDto[]>((resolve) => {
      resolveSlow = resolve;
    });
    vi.mocked(getMyJiraCredentials)
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce([cred("fresh")]);

    const { result } = renderHook(() => useJiraCredentials());

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
