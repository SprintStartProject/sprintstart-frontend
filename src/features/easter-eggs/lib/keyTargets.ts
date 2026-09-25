/**
 * Key-target guards shared by the easter-egg games and the Space-to-play
 * trigger. Generic keyboard helpers, so they live here rather than in any one
 * game's hook.
 */

/** Shared guard: true while the event landed in a text field that owns the keys. */
export const isTypingTarget = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable === true);

/**
 * Controls on which Space already has a meaning of its own: activating a
 * button, toggling a checkbox or switch, opening a select or a disclosure.
 */
const SPACE_ACTIVATED_SELECTOR = [
  "button",
  "select",
  "summary",
  "a[href]",
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="tab"]',
].join(", ");

/**
 * True when Space pressed on `el` belongs to the element rather than to a
 * global shortcut: any text field (see {@link isTypingTarget}) plus every
 * control Space activates.
 *
 * Separate from `isTypingTarget` on purpose — the games themselves use that
 * one to decide whether a key is typing, and a focused button is not typing.
 * Only the Space-to-play trigger needs the wider set, because swallowing
 * Space on a focused "Send" button would open a game instead of pressing it.
 *
 * A disabled control is the exception: Space on it does nothing, and a
 * busy button (`ui/Button` with `loading`) is disabled while it may still
 * hold focus, so treating it as the owner of Space would keep the game
 * shut for exactly the wait it exists for.
 */
export const isInteractiveTarget = (el: EventTarget | null): boolean =>
  isTypingTarget(el) ||
  (el instanceof Element &&
    el.matches(SPACE_ACTIVATED_SELECTOR) &&
    !el.matches(':disabled, [aria-disabled="true"]'));
