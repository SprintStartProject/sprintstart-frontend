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

  it("starts locked and with no game active", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.gameActive).toBe(false);
    expect(result.current.toast).toBeNull();
  });

  it("unlocks after three cogwheel clicks and shows a toast", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(result.current.isUnlocked).toBe(false);

    act(() => result.current.handleIconClick());
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.toast).toContain("press Space");
    expect(window.localStorage.getItem("dinoUnlocked")).toBe("true");
  });

  it("locks again after three more clicks", () => {
    window.localStorage.setItem("dinoUnlocked", "true");
    const { result } = renderHook(() => useDinoEasterEgg());

    expect(result.current.isUnlocked).toBe(true);

    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());

    expect(result.current.isUnlocked).toBe(false);
    expect(window.localStorage.getItem("dinoUnlocked")).toBe("false");
  });

  it("debounces rapid toggles (three clicks within 2s only toggles once)", () => {
    const { result } = renderHook(() => useDinoEasterEgg());

    // First triple-click unlocks.
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(result.current.isUnlocked).toBe(true);

    // Immediate second triple-click is debounced — stays unlocked.
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    act(() => result.current.handleIconClick());
    expect(result.current.isUnlocked).toBe(true);
  });
});
