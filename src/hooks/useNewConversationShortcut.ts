import {
  NEW_CONVERSATION_SHORTCUT,
  shortcutChord,
  useShortcutListener,
} from "../features/shortcuts";

/**
 * The chord, in one place, so the handler and the hint on the button cannot disagree.
 *
 * Deliberately not `Ctrl+N`, which is what was asked for first: every desktop browser owns
 * that one and opens a window with it, and a page cannot refuse. `Alt` keeps the mnemonic and
 * is free. (The chord itself, with that reasoning, lives in the shortcuts registry where the
 * listener matches it; this export stays the chat button's way of naming it.)
 */
export const NEW_CONVERSATION_CHORD = shortcutChord(NEW_CONVERSATION_SHORTCUT);

/**
 * `Alt+N` starts a new conversation in whichever half of the assistant is open.
 *
 * The matching — `event.code` rather than `event.key`, the AltGr refusal, the auto-repeat
 * guard — is the shortcuts registry's ({@link useShortcutListener} against the registry's
 * item), so this hook reads the same rule every other chord does instead of its own copy
 * of it.
 *
 * **It fires while the composer has focus**, unlike the easter-egg chords, which stand back
 * whenever anything is being typed into. That is the difference between a shortcut for a game
 * and a shortcut for this: the moment somebody most wants a fresh conversation is halfway
 * through typing into the wrong one. The cost is on macOS, where `Option+N` is the dead key
 * for `ñ` — worth naming, and the trade this app is happy with on a Windows-first team.
 *
 * @param enabled Leave false where there is nothing to start — an untouched buddy visit is
 *   already the new conversation, and re-opening it would only replay the greeting. Both halves
 *   of the assistant also gate it on being the one on screen: the shell keeps the page being
 *   left mounted for the length of the slide, and this listener is on `window`, so during that
 *   window one keypress would otherwise be answered twice.
 */
export function useNewConversationShortcut(onTrigger: () => void, enabled = true): void {
  useShortcutListener(NEW_CONVERSATION_SHORTCUT, onTrigger, enabled);
}
