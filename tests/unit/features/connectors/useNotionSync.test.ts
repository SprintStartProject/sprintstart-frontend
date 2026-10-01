import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../../../src/services/apiClient";
import { useNotionSync } from "../../../../src/features/connectors/components/useNotionSync";
import { notionService } from "../../../../src/services/sources/notionService";

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => toast,
}));

vi.mock("../../../../src/services/sources/notionService", () => ({
  notionService: { syncConnection: vi.fn() },
}));

const syncMock = vi.mocked(notionService.syncConnection);

describe("useNotionSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["CREATED", "success", "Notion page ingested"],
    ["UPDATED", "success", "Notion page updated"],
    ["UNCHANGED", "info", "Notion page is up to date"],
  ] as const)("reports %s as a %s toast", async (outcome, level, title) => {
    syncMock.mockResolvedValue({ runId: "run-1", connectionId: "conn-1", outcome });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useNotionSync("proj-1"));

    await act(async () => {
      await result.current.syncConnection("conn-1", onSuccess);
    });

    expect(syncMock).toHaveBeenCalledWith("proj-1", "conn-1");
    expect(toast[level]).toHaveBeenCalledWith(title, expect.anything());
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("reports a failed outcome with the backend's reason and still refreshes", async () => {
    syncMock.mockResolvedValue({
      runId: "run-1",
      connectionId: "conn-1",
      outcome: "FAILED",
      failure: { stage: "FETCH", message: "Page not shared" },
    });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useNotionSync("proj-1"));

    const returned = await act(async () => result.current.syncConnection("conn-1", onSuccess));

    expect(returned.outcome).toBe("FAILED");
    expect(toast.error).toHaveBeenCalledWith("Notion sync failed", {
      description: "Page not shared (FETCH)",
    });
    // The run was recorded, so the page still reloads its history.
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic hint when a failed outcome carries no reason", async () => {
    syncMock.mockResolvedValue({ runId: "run-1", connectionId: "conn-1", outcome: "FAILED" });
    const { result } = renderHook(() => useNotionSync("proj-1"));

    await act(async () => {
      await result.current.syncConnection("conn-1");
    });

    const [title, options] = toast.error.mock.calls[0] as [string, { description: string }];
    expect(title).toBe("Notion sync failed");
    expect(options.description).toContain("shared with the integration");
  });

  it("reports a failed request once and rethrows it", async () => {
    syncMock.mockRejectedValue(new ApiError(502, "Notion is unreachable"));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useNotionSync("proj-1"));

    await act(async () => {
      await expect(result.current.syncConnection("conn-1", onSuccess)).rejects.toThrow(
        "Notion is unreachable",
      );
    });

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Notion is unreachable");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.syncingId).toBeNull();
  });

  it("refuses to sync without a project", async () => {
    const { result } = renderHook(() => useNotionSync(null));

    await act(async () => {
      await expect(result.current.syncConnection("conn-1")).rejects.toThrow("Project ID");
    });

    expect(syncMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("tracks which connection is syncing while the request is in flight", async () => {
    let finish: () => void = () => {};
    syncMock.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ runId: "r", connectionId: "conn-1", outcome: "UNCHANGED" });
      }),
    );
    const { result } = renderHook(() => useNotionSync("proj-1"));

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.syncConnection("conn-1");
    });
    expect(result.current.syncingId).toBe("conn-1");

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.syncingId).toBeNull();
  });
});
