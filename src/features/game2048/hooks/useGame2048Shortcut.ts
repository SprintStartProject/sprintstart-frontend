import { useEffect } from "react";

/**
 * Listen for the Ctrl+Shift+2 keyboard chord and fire `onTrigger`.
 *
 * The "2" hints at 2048. Mirrors the DinoGame pattern in ChatPage: ignores
 * the chord when the user is typing in a textarea/input/contentEditable so
 * we don't hijack regular editing.
 *
 * @param onTrigger called once per chord press (auto-repeat suppressed)
 */
export function useGame2048Shortcut(onTrigger: () => void): void {
  useEffect(() => {
    const isTypingTarget = (el: Element | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      // Use e.code (physical key) instead of e.key (produced character):
      // Shift+2 produces "@" on US QWERTY and '"' on German QWERTZ, so
      // e.key === "2" only matches when Shift is NOT pressed — which
      // defeats the whole chord. e.code === "Digit2" is layout-stable.
      if (!(e.ctrlKey && e.shiftKey && e.code === "Digit2")) return;
      if (isTypingTarget(document.activeElement)) return;
      if (e.repeat) return;

      e.preventDefault();
      onTrigger();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}
