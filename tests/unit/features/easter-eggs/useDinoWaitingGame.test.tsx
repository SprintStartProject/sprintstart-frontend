import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import {
  isInteractiveTarget,
  isTypingTarget,
  useDinoUnlocked,
  useSpaceOpensDino,
} from "../../../../src/features/easter-eggs/hooks/useDinoWaitingGame.ts";

describe("useDinoWaitingGame hooks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
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

    it("keeps the current game active until manual close when keepActiveUntilExit is true", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result, rerender } = renderHook(
        ({ armed }) => useSpaceOpensDino(armed, true, { keepActiveUntilExit: true }),
        {
          initialProps: { armed: true },
        },
      );

      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(result.current[0]).toBe(true);

      // When armed flips off (reply arrives), game stays active so user can finish their run.
      rerender({ armed: false });
      expect(result.current[0]).toBe(true);

      // Exiting manually closes the game and frees the slot.
      act(() => {
        result.current[1]();
      });
      expect(result.current[0]).toBe(false);

      // Cannot open a new game while armed is false.
      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });
      expect(result.current[0]).toBe(false);
    });

    it("opens exactly one game when two armed hosts see the same Space press", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const first = renderHook(() => useSpaceOpensDino(true, true));
      const second = renderHook(() => useSpaceOpensDino(true, true));

      act(() => {
        fireEvent.keyDown(window, { code: "Space" });
      });

      const openCount = [first.result.current[0], second.result.current[0]].filter(Boolean).length;
      expect(openCount).toBe(1);
    });

    it.each([
      ["button", () => document.createElement("button")],
      ["select", () => document.createElement("select")],
      [
        "link",
        () => {
          const a = document.createElement("a");
          a.href = "#x";
          return a;
        },
      ],
      [
        "role=switch",
        () => {
          const el = document.createElement("div");
          el.setAttribute("role", "switch");
          el.tabIndex = 0;
          return el;
        },
      ],
    ])("leaves Space to a focused %s", (_name, make) => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result } = renderHook(() => useSpaceOpensDino(true, true));
      const control = make();
      document.body.appendChild(control);
      control.focus();

      let event!: KeyboardEvent;
      act(() => {
        event = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
        control.dispatchEvent(event);
      });

      expect(result.current[0]).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });

    it.each([
      ["ctrlKey", { ctrlKey: true }],
      ["metaKey", { metaKey: true }],
      ["altKey", { altKey: true }],
      ["shiftKey", { shiftKey: true }],
      ["repeat", { repeat: true }],
    ])("ignores Space with %s", (_name, init) => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result } = renderHook(() => useSpaceOpensDino(true, true));

      act(() => {
        fireEvent.keyDown(window, { code: "Space", ...init });
      });

      expect(result.current[0]).toBe(false);
    });

    it("ignores a Space press someone else already handled", () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const { result } = renderHook(() => useSpaceOpensDino(true, true));
      const claim = (e: KeyboardEvent) => e.preventDefault();
      window.addEventListener("keydown", claim, { capture: true });

      try {
        act(() => {
          fireEvent.keyDown(window, { code: "Space" });
        });
        expect(result.current[0]).toBe(false);
      } finally {
        window.removeEventListener("keydown", claim, { capture: true });
      }
    });
  });

  describe("target helpers", () => {
    it("keeps isTypingTarget to text fields while isInteractiveTarget adds controls", () => {
      const input = document.createElement("input");
      const button = document.createElement("button");
      const div = document.createElement("div");

      expect(isTypingTarget(input)).toBe(true);
      expect(isTypingTarget(button)).toBe(false);
      expect(isInteractiveTarget(input)).toBe(true);
      expect(isInteractiveTarget(button)).toBe(true);
      expect(isInteractiveTarget(div)).toBe(false);
      expect(isInteractiveTarget(null)).toBe(false);
    });

    it("lets Space through on a disabled control, which has no Space action", () => {
      // A busy ui/Button is disabled while it can still hold focus; it must not
      // keep the game shut for the very wait the game exists for.
      const busy = document.createElement("button");
      busy.disabled = true;
      const ariaBusy = document.createElement("div");
      ariaBusy.setAttribute("role", "button");
      ariaBusy.setAttribute("aria-disabled", "true");
      const disabledInput = document.createElement("input");
      disabledInput.disabled = true;

      expect(isInteractiveTarget(busy)).toBe(false);
      expect(isInteractiveTarget(ariaBusy)).toBe(false);
      // Text fields stay protected either way: the typing guard is unchanged.
      expect(isInteractiveTarget(disabledInput)).toBe(true);
    });
  });

  describe("useDinoUnlocked storage guard", () => {
    it("treats unreadable storage as locked instead of throwing", () => {
      const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
      try {
        const { result } = renderHook(() => useDinoUnlocked());
        expect(result.current).toBe(false);
        act(() => {
          fireEvent(window, new Event("dinoUnlockChanged"));
        });
        expect(result.current).toBe(false);
      } finally {
        getItem.mockRestore();
      }
    });
  });
});
