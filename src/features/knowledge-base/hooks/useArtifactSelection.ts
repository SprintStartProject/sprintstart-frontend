import { useCallback, useEffect, useState, type RefObject } from "react";

/** Anything shorter is a stray click or a double-click that caught a space. */
const MIN_SELECTION_LENGTH = 2;

/**
 * Whatever the reader has highlighted inside `containerRef`, while they have it.
 *
 * Scoped by containment rather than by page: the drawer's action row offers to
 * ask about the *document's* words, and a selection made in the header, in
 * another panel, or anywhere else in the app is not this drawer's to quote.
 *
 * Listens on `selectionchange` rather than on mouse-up, so a selection made with
 * the keyboard (shift-arrow) counts exactly as much as one made by dragging.
 *
 * `clear` exists because acting on a selection should end it: leaving the offer
 * up over words that are already on their way to the chat invites asking twice.
 */
export function useArtifactSelection(containerRef: RefObject<HTMLElement | null>): {
  text: string | null;
  clear: () => void;
} {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    function read() {
      const selection = window.getSelection();
      const container = containerRef.current;

      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !container) {
        setText(null);
        return;
      }

      const selected = selection.toString().trim();
      const range = selection.getRangeAt(0);

      if (
        selected.length < MIN_SELECTION_LENGTH ||
        !container.contains(range.commonAncestorContainer)
      ) {
        setText(null);
        return;
      }

      setText(selected);
    }

    document.addEventListener("selectionchange", read);

    return () => document.removeEventListener("selectionchange", read);
  }, [containerRef]);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setText(null);
  }, []);

  return { text, clear };
}
