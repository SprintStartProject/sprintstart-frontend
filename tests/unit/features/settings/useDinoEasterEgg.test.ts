import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDinoEasterEgg } from "../../../../src/features/settings/hooks/useDinoEasterEgg.ts";

describe("useDinoEasterEgg", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with no notice", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    expect(result.current.kind).toBeNull();
  });

  it("unlocks after three cogwheel clicks and shows a toast", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(result.current.kind).toBeNull();
    expect(window.localStorage.getItem("dinoUnlocked")).toBeNull();

    act(() => result.current.handleIconClick());
    expect(result.current.kind).toBe("unlocked");
    expect(window.localStorage.getItem("dinoUnlocked")).toBe("true");
  });

  it("broadcasts dinoUnlockChanged so other surfaces can arm the game", () => {
    const { result } = renderHook(() => useDinoEasterEgg());
    const listener = vi.fn();
    window.addEventListener("dinoUnlockChanged", listener, { once: true });

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());

    // The event is dispatched on a microtask, deliberately deferred past
    // the render cycle — flush microtasks before asserting.
    return Promise.resolve().then(() => {
      expect(listener).toHaveBeenCalled();
    });
  });

  it("locks again after three more clicks", () => {
    window.localStorage.setItem("dinoUnlocked", "true");
    const { result } = renderHook(() => useDinoEasterEgg());

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());

    expect(window.localStorage.getItem("dinoUnlocked")).toBe("false");
    expect(result.current.kind).toBe("locked");
  });

  it("reports kind 'unlocked' then 'locked' across two toggles", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDinoEasterEgg());
      const tripleClick = () => {
        act(() => result.current.handleIconClick());
        act(() => result.current.handleIconClick());
        act(() => result.current.handleIconClick());
      };

      tripleClick();
      expect(result.current.kind).toBe("unlocked");

      // Step past the 2s toggle debounce (and the 3s notice) before re-toggling.
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      expect(result.current.kind).toBeNull();

      tripleClick();
      expect(result.current.kind).toBe("locked");
      expect(window.localStorage.getItem("dinoUnlocked")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("debounces rapid toggles (second triple-click within 2s is ignored)", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    // First triple-click unlocks.
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(window.localStorage.getItem("dinoUnlocked")).toBe("true");

    // Immediate second triple-click is debounced — stays unlocked.
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(window.localStorage.getItem("dinoUnlocked")).toBe("true");
  });
});
