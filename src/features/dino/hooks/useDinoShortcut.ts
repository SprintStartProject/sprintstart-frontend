import { useEffect } from "react";

/**
 * Listen for the Ctrl+Shift+1 keyboard chord and fire `onTrigger`.
 *
 * The "1" hints at the dino runner (the first easter egg in the app — it
 * was the original hidden game before 2048 was added). Mirrors the
 * Game2048Shortcut pattern: ignores the chord when the user is typing in
 * a textarea/input/contentEditable so we don't hijack regular editing.
 *
 * @param onTrigger called once per chord press (auto-repeat suppressed)
 */
export function useDinoShortcut(onTrigger: () => void): void {
  useEffect(() => {
    const isTypingTarget = (el: Element | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      // Use e.code (physical key) instead of e.key (produced character):
      // Shift+1 produces "!" on both US QWERTY and German QWERTZ, so
      // e.key === "1" only matches when Shift is NOT pressed — which
      // defeats the whole chord. e.code === "Digit1" is layout-stable.
      if (!(e.ctrlKey && e.shiftKey && e.code === "Digit1")) return;
      if (isTypingTarget(document.activeElement)) return;
      if (e.repeat) return;

      e.preventDefault();
      onTrigger();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}
