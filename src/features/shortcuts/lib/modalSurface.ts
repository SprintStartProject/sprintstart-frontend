/**
 * "A modal surface owns the keyboard while it is up" — the one definition the global layer
 * and the surface listeners both stand down for.
 *
 * Why it exists: navigating off a half-filled dialog would unmount it mid-edit, the help
 * would stack a second overlay on the first with one Escape closing both, and `Alt+N` would
 * start a conversation under a dialog still asking its question.
 *
 * `aria-modal="true"` is the precise line. `ui/Modal` (dialogs and alert dialogs), the canvas
 * covers, the side panel and the celebration overlays all announce themselves this way; the
 * buddy dock and the popover-style popups deliberately do not, because they are non-modal by
 * design — treating those as keyboard owners would freeze every chord for as long as the dock
 * stayed open.
 *
 * The `:not(…)` half guards against the other trap: an overlay that is *kept mounted* while
 * closed. `ui/SidePanel` does exactly that so its backdrop can fade (a closed panel is
 * `aria-hidden` and `inert`), and the Board keeps one alive for the whole visit — a selector
 * of just `[aria-modal="true"]` finds it and silences every chord on the page.
 */
export const MODAL_SURFACE_SELECTOR = '[aria-modal="true"]:not([aria-hidden="true"]):not([inert])';

/** True while a modal surface is on screen and owning the keyboard. */
export function isModalSurfaceOpen(): boolean {
  return document.querySelector(MODAL_SURFACE_SELECTOR) !== null;
}
