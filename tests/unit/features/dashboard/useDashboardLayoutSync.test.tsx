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
  markLayoutSynced,
  readLayoutSynced,
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
    await waitFor(() => expect(readLayoutSynced("user-1")).toBe(true));
  });

  it("drops a stale copy instead of bringing back a layout that was reset on another device", async () => {
    // This browser synced the layout earlier; since then the user reset it somewhere else.
    storeLayout("user-1", LOCAL);
    markLayoutSynced("user-1");
    service.fetchLayout.mockResolvedValue(nothingStored());
    const onPulled = vi.fn();

    renderHook(() => useDashboardLayoutSync("user-1", onPulled));

    await waitFor(() => expect(onPulled).toHaveBeenCalledTimes(1));
    expect(readStoredLayout("user-1", DASHBOARD_WIDGET_IDS)).toBeNull();
    expect(service.saveLayout).not.toHaveBeenCalled();
  });

  it("does not treat a failed migration as synced, so the next visit tries again", async () => {
    storeLayout("user-1", LOCAL);
    service.fetchLayout.mockResolvedValue(nothingStored());
    service.saveLayout.mockRejectedValue(new Error("offline"));

    renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));

    await waitFor(() => expect(service.saveLayout).toHaveBeenCalled());
    await act(async () => {});
    expect(readLayoutSynced("user-1")).toBe(false);
    expect(readStoredLayout("user-1", DASHBOARD_WIDGET_IDS)).toEqual(LOCAL);
  });

  it("uploads a change whose PUT failed instead of reading it as a reset elsewhere", async () => {
    // Nothing anywhere, and the first read settles — this browser is now in sync with the server.
    service.fetchLayout.mockResolvedValue(nothingStored());
    const first = renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));
    await waitFor(() => expect(readLayoutSynced("user-1")).toBe(true));

    // The user arranges the dashboard (the dashboard writes storage itself), and the PUT fails.
    service.saveLayout.mockRejectedValue(new Error("offline"));
    storeLayout("user-1", LOCAL);
    act(() => first.result.current.push(LOCAL));
    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));
    first.unmount();

    // Next visit: the server is still empty.
    service.saveLayout.mockReset();
    service.saveLayout.mockResolvedValue(undefined);
    const onPulled = vi.fn();
    renderHook(() => useDashboardLayoutSync("user-1", onPulled));

    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));
    expect(readStoredLayout("user-1", DASHBOARD_WIDGET_IDS)).toEqual(LOCAL);
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("does not vouch for a change made while an earlier PUT was on its way", async () => {
    service.fetchLayout.mockResolvedValue(nothingStored());
    const { result } = renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));
    await waitFor(() => expect(readLayoutSynced("user-1")).toBe(true));

    let finishFirst: () => void = () => {};
    service.saveLayout.mockReturnValueOnce(new Promise<void>((resolve) => (finishFirst = resolve)));

    act(() => result.current.push(LOCAL));
    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));

    // A newer change while the first PUT is still in flight; then the first one answers.
    act(() => result.current.push(SERVER));
    await act(() => {
      finishFirst();
      return Promise.resolve();
    });

    expect(readLayoutSynced("user-1")).toBe(false);
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

  it("still sends a change made while the held one is being sent", async () => {
    let answer: (value: DashboardLayoutWire) => void = () => {};
    service.fetchLayout.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    let finishFlush: () => void = () => {};
    service.saveLayout.mockReturnValueOnce(new Promise<void>((resolve) => (finishFlush = resolve)));

    const { result } = renderHook(() => useDashboardLayoutSync("user-1", vi.fn()));

    act(() => result.current.push(LOCAL));
    await act(() => {
      answer(nothingStored());
      return Promise.resolve();
    });
    await waitFor(() => expect(service.saveLayout).toHaveBeenCalledWith(LAYOUT_VERSION, LOCAL));

    // The held change is still on its way when the next one is made.
    act(() => result.current.push(SERVER));
    await act(() => {
      finishFlush();
      return Promise.resolve();
    });

    await waitFor(() =>
      expect(service.saveLayout).toHaveBeenLastCalledWith(LAYOUT_VERSION, SERVER),
    );
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
