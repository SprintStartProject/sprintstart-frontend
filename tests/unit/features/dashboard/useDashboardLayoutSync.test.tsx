import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/services/dashboardLayoutService", () => ({
  dashboardLayoutService: {
    fetchLayout: vi.fn(),
    saveLayout: vi.fn(),
    resetLayout: vi.fn(),
  },
}));

import { dashboardLayoutService } from "../../../../src/services/dashboardLayoutService";
import {
  LAYOUT_VERSION,
  readStoredLayout,
  storeLayout,
} from "../../../../src/features/dashboard/layout/storage";
import { DASHBOARD_WIDGET_IDS } from "../../../../src/features/dashboard/layout/catalog";
import { useDashboardLayoutSync } from "../../../../src/features/dashboard/layout/useDashboardLayoutSync";
import type { DashboardLayout } from "../../../../src/features/dashboard/layout/types";
import type { DashboardLayoutWire } from "../../../../src/services/dashboardLayoutService";

const service = vi.mocked(dashboardLayoutService);

const LOCAL: DashboardLayout = [
  { id: "greeting", size: "wide" },
  { id: "skills", size: "small" },
];

const SERVER: DashboardLayout = [
  { id: "skills", size: "medium" },
  { id: "greeting", size: "wide" },
];

function nothingStored(): DashboardLayoutWire {
  return { version: LAYOUT_VERSION, items: [], updatedAt: null };
}

describe("useDashboardLayoutSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    service.saveLayout.mockResolvedValue(undefined);
    service.resetLayout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the layout under the client's version", async () => {
    service.fetchLayout.mockResolvedValue(nothingStored());

    renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));

    await waitFor(() => expect(service.fetchLayout).toHaveBeenCalledWith(LAYOUT_VERSION));
  });

  it("lets the server's layout win and asks the dashboard to read it again", async () => {
    storeLayout("user-1", LOCAL);
    service.fetchLayout.mockResolvedValue({
      version: LAYOUT_VERSION,
      items: SERVER,
      updatedAt: "2026-09-30T10:00:00Z",
    });
    const onPulled = vi.fn();

    renderHook(() => useDashboardLayoutSync("user-1", onPulled));

    await waitFor(() => expect(onPulled).toHaveBeenCalledTimes(1));
    expect(readStoredLayout("user-1", DASHBOARD_WIDGET_IDS)).toEqual(SERVER);
    expect(service.saveLayout).not.toHaveBeenCalled();
  });

  it("sends this browser's layout up when the server has none", async () => {
    storeLayout("user-1", LOCAL);
    service.fetchLayout.mockResolvedValue(nothingStored());
    const onPulled = vi.fn();

    renderHook(() => useDashboardLayoutSync("user-1", onPulled));

    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("does nothing for a user with a layout nowhere", async () => {
    service.fetchLayout.mockResolvedValue(nothingStored());

    renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));

    await waitFor(() => expect(service.fetchLayout).toHaveBeenCalled());
    expect(service.saveLayout).not.toHaveBeenCalled();
  });

  it("keeps a change made before the first read instead of applying the server's copy", async () => {
    let answer: (value: DashboardLayoutWire) => void = () => {};
    service.fetchLayout.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const onPulled = vi.fn();

    const { result } = renderHook(() => useDashboardLayoutSync("user-1", onPulled));

    act(() => result.current.push(LOCAL));
    await act(() => {
      answer({ version: LAYOUT_VERSION, items: SERVER, updatedAt: "2026-09-30T10:00:00Z" });
      return Promise.resolve();
    });

    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("debounces changes into one request with the latest layout", async () => {
    service.fetchLayout.mockResolvedValue(nothingStored());
    const { result } = renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));
    await waitFor(() => expect(service.fetchLayout).toHaveBeenCalled());
    // Let the first read settle before timing the pushes.
    await act(async () => {});

    vi.useFakeTimers();
    act(() => {
      result.current.push(LOCAL);
      result.current.push(SERVER);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(service.saveLayout).toHaveBeenCalledTimes(1);
    expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, SERVER);
  });

  it("forgets the layout on the server on reset", async () => {
    service.fetchLayout.mockResolvedValue(nothingStored());
    const { result } = renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));
    await waitFor(() => expect(service.fetchLayout).toHaveBeenCalled());
    await act(async () => {});

    act(() => result.current.reset());

    expect(service.resetLayout).toHaveBeenCalledTimes(1);
  });

  it("keeps working from local storage when the server cannot be reached", async () => {
    storeLayout("user-1", LOCAL);
    service.fetchLayout.mockRejectedValue(new Error("offline"));

    renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));

    await waitFor(() => expect(service.fetchLayout).toHaveBeenCalled());
    expect(readStoredLayout("user-1", DASHBOARD_WIDGET_IDS)).toEqual(LOCAL);
  });
});
