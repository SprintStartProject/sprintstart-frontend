import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDinoEasterEgg } from "../../../../src/features/settings/hooks/useDinoEasterEgg";

describe("useDinoEasterEgg", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with no toast", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    expect(result.current.toast).toBeNull();
  });

  it("unlocks after three cogwheel clicks and shows a toast", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(result.current.toast).toBeNull();
    expect(window.localStorage.getItem("dinoUnlocked")).toBeNull();

    act(() => result.current.handleIconClick());
    expect(result.current.toast).toContain("press Space");
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
