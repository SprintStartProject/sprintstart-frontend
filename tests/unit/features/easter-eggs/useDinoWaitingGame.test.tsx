import { afterEach, describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import {
  useDinoUnlocked,
  useSpaceOpensDino,
} from "../../../../src/features/easter-eggs/hooks/useDinoWaitingGame";

describe("useDinoWaitingGame hooks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe("useDinoUnlocked", () => {
    it("reads the persisted flag and follows dinoUnlockChanged events", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result } = renderHook(() => useDinoUnlocked());
      expect(result.current).toBe(true);

      act(() => {
        fireEvent(window, new Event("dinoUnlockChanged"));
      });

      // Flag still true — state stays true.
      expect(result.current).toBe(true);

      window.localStorage.setItem("dinoUnlocked", "false");
      act(() => {
        fireEvent(window, new Event("dinoUnlockChanged"));
      });
      expect(result.current).toBe(false);
    });
  });

  describe("useSpaceOpensDino", () => {
    it("opens only when armed AND unlocked, on Space outside inputs", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result } = renderHook(() => useSpaceOpensDino(true, true));

      // Space while "typing" in an input is ignored.
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(result.current[0]).toBe(false);
      input.blur();

      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(result.current[0]).toBe(true);

      act(() => {
        result.current[1]();
      });
      expect(result.current[0]).toBe(false);
    });

    it("ignores Space when not unlocked or not armed", () => {
      const locked = renderHook(() => useSpaceOpensDino(true, false));
      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(locked.result.current[0]).toBe(false);
      locked.unmount();

      const disarmed = renderHook(() => useSpaceOpensDino(false, true));
      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(disarmed.result.current[0]).toBe(false);
    });

    it("closes automatically when the passed unlock flag flips off mid-game", () => {
      const { result, rerender } = renderHook(({ unlocked }) => useSpaceOpensDino(true, unlocked), {
        initialProps: { unlocked: true },
      });

      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(result.current[0]).toBe(true);

      // Consumer re-renders with a fresh unlock value (e.g. another tab
      // or the Settings cogwheel re-locked the game).
      rerender({ unlocked: false });
      expect(result.current[0]).toBe(false);
    });

    it("closes when the wait ends and frees the slot for the next surface", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const first = renderHook(({ armed }) => useSpaceOpensDino(armed, true), {
        initialProps: { armed: true },
      });

      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(first.result.current[0]).toBe(true);

      // The wait ended (the answer arrived, the path was generated): the game
      // goes with it — its DOM already did.
      first.rerender({ armed: false });
      expect(first.result.current[0]).toBe(false);

      // And the shared slot is free again: a second armed host can open its
      // own game. Before, the finished wait kept the slot claimed and Space
      // did nothing for the rest of the visit.
      const second = renderHook(() => useSpaceOpensDino(true, true));
      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(second.result.current[0]).toBe(true);

      second.unmount();
      first.unmount();
    });
  });
});
