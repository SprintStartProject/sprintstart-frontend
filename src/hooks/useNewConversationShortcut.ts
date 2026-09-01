import { useEffect } from "react";

/**
 * The chord, in one place, so the handler and the hint on the button cannot disagree.
 *
 * Deliberately not `Ctrl+N`, which is what was asked for first: every desktop browser owns
 * that one and opens a window with it, and a page cannot refuse. `Alt` keeps the mnemonic and
 * is free.
 */
export const NEW_CONVERSATION_CHORD = "Alt + N";

/**
 * `Alt+N` starts a new conversation in whichever half of the assistant is open.
 *
 * `event.code` rather than `event.key`, for the reason the other chords in this app use it:
 * `key` is the character produced, which depends on the layout and on the modifiers, while
 * `KeyN` is the physical key wherever the keyboard was made.
 *
 * **It fires while the composer has focus**, unlike the easter-egg chords, which stand back
 * whenever anything is being typed into. That is the difference between a shortcut for a game
 * and a shortcut for this: the moment somebody most wants a fresh conversation is halfway
 * through typing into the wrong one. The cost is on macOS, where `Option+N` is the dead key
 * for `ñ` — worth naming, and the trade this app is happy with on a Windows-first team.
 *
 * `ctrlKey`/`metaKey` are refused rather than ignored: AltGr reports itself as Ctrl+Alt, so
 * accepting a bare `altKey` would fire this on every AltGr chord a European layout produces.
 *
 * @param enabled Leave false where there is nothing to start — an untouched buddy visit is
 *   already the new conversation, and re-opening it would only replay the greeting.
 */
export function useNewConversationShortcut(onTrigger: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code !== "KeyN") return;
      if (event.repeat) return;

      event.preventDefault();
      onTrigger();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger, enabled]);
}
