import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotionCredentials } from "../../../../src/features/settings/hooks/useNotionCredentials";
import type { NotionCredentialDto } from "../../../../src/services/sources/notionService";

vi.mock("../../../../src/services/sources/notionService", () => ({
  getMyNotionCredentials: vi.fn(),
}));

import { getMyNotionCredentials } from "../../../../src/services/sources/notionService";

const cred = (name: string): NotionCredentialDto => ({
  name,
  workspaceId: "ws-1",
  workspaceName: "Acme Workspace",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("useNotionCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated user's credentials on mount", async () => {
    vi.mocked(getMyNotionCredentials).mockResolvedValue([cred("wiki"), cred("docs")]);

    const { result } = renderHook(() => useNotionCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials.map((c) => c.name)).toEqual(["wiki", "docs"]);
    expect(result.current.error).toBeNull();
    expect(getMyNotionCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("settles into a loaded-empty state without fetching when disabled", async () => {
    const { result } = renderHook(() => useNotionCredentials(false));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.credentials).toEqual([]);
    expect(getMyNotionCredentials).not.toHaveBeenCalled();
  });

  it("surfaces an error message when loading fails", async () => {
    vi.mocked(getMyNotionCredentials).mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useNotionCredentials());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe("Network down");
    expect(result.current.credentials).toEqual([]);
  });

  it("reloads credentials via reload", async () => {
    vi.mocked(getMyNotionCredentials)
      .mockResolvedValueOnce([cred("a")])
      .mockResolvedValueOnce([cred("a"), cred("b")]);

    const { result } = renderHook(() => useNotionCredentials());

    await waitFor(() => expect(result.current.credentials.map((c) => c.name)).toEqual(["a"]));

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.credentials.map((c) => c.name)).toEqual(["a", "b"]));
  });

  it("addCredentialLocally appends once and ignores a duplicate name", async () => {
    vi.mocked(getMyNotionCredentials).mockResolvedValue([cred("a")]);

    const { result } = renderHook(() => useNotionCredentials());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.addCredentialLocally(cred("b"));
      result.current.addCredentialLocally(cred("b"));
    });

    await waitFor(() => expect(result.current.credentials.map((c) => c.name)).toEqual(["a", "b"]));
  });
});
