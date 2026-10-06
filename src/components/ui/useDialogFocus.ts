import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Everything inside `container` a keyboard can reach, in document order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("aria-hidden"),
  );
}

/**
 * What a dialog owes a keyboard: focus moves in when it opens, Tab stays inside while it is open,
 * and focus goes back where it came from when it closes.
 *
 * Shared, because there is more than one dialog in this app that is not a {@link Modal}: the
 * canvases open a node as a layer over the graph rather than as an overlay in a portal, and
 * without this a keyboard user pressed Enter on a node and kept focus on the node now covered by
 * the thing they opened -- then had to Tab through every remaining node, the minimap and the zoom
 * toolbar to reach it.
 *
 * Returns the ref to put on the dialog element. Give that element `tabIndex={-1}` so it can take
 * focus itself when it holds no focusable control.
 *
 * `onEscape` is for the dialogs that close themselves (an off-canvas drawer); a `Modal` brings
 * its own Escape handling and passes nothing. Escape is left alone when something inside has
 * already used it (`defaultPrevented`), such as an open menu.
 */
export function useDialogFocus<T extends HTMLElement>(
  isOpen: boolean,
  onEscape?: () => void,
): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!isOpen) return;

    const dialogAtOpen = dialogRef.current;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      // The autofocus runs a frame late, so a keyboard user (or a test typing into the dialog) may
      // already have moved focus inside it by now. Don't yank it back to the first control.
      const active = document.activeElement;
      if (active && active !== dialog && dialog.contains(active)) return;

      const [firstFocusable] = getFocusableElements(dialog);
      (firstFocusable ?? dialog).focus();
    });

    return () => {
      // Give focus back only if it is still in the dialog or nowhere. If a route change (or
      // anything else) has already moved it somewhere on purpose, taking it back would undo that.
      const active = document.activeElement;
      const focusIsFree =
        !active || active === document.body || (dialogAtOpen?.contains(active) ?? false);
      if (focusIsFree) previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && onEscapeRef.current && !event.defaultPrevented) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return dialogRef;
}
