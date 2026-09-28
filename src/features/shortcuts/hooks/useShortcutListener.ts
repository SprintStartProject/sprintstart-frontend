import { useEffect } from "react";
import { isShortcutPress, type ShortcutItem } from "../shortcuts";

/**
 * Answers one registered chord outside the shortcuts layer.
 *
 * The listener every `scope: "surface"` owner uses: the sidebar's drawer, the project
 * switcher's dialog, the chat surfaces' new conversation. What counts as a press is the
 * registry's rule ({@link isShortcutPress}) — this hook only decides when to listen and
 * what a press does.
 *
 * @param onTrigger Called with the event already `preventDefault`ed.
 * @param enabled Gate the listener where the thing it acts on is not on screen — an
 *   unmounted surface must not answer for a mounted one.
 */
export function useShortcutListener(
  shortcut: ShortcutItem,
  onTrigger: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isShortcutPress(event, shortcut)) return;

      event.preventDefault();
      onTrigger();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut, onTrigger, enabled]);
}
