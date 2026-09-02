import { useCallback, useEffect, useState } from "react";
import { captureSelection, type CapturedSelection } from "./selectionCapture";

/**
 * The hire's current text selection, whenever there is one worth offering an action for.
 *
 * Listens on `selectionchange` rather than on mouse-up, so a selection made with the keyboard
 * (shift-arrow) counts exactly as much as one made by dragging.
 *
 * `clear` exists because acting on a selection should end it: leaving the toolbar hanging over
 * text the hire has already filed invites them to file it twice.
 */
export function useTextSelection(): {
  selection: CapturedSelection | null;
  clear: () => void;
} {
  const [selection, setSelection] = useState<CapturedSelection | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const clear = useCallback(() => {
    setSelection(null);
    setDismissed(true);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    function read() {
      const captured = captureSelection(window.getSelection());
      setSelection(captured);
      // A new selection is a new intent, so a previous dismissal stops applying.
      if (captured) setDismissed(false);
    }

    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);

  useEffect(() => {
    // The rect is in viewport coordinates and the page can move under it. Recomputing on scroll
    // beats freezing the toolbar somewhere the text no longer is.
    if (!selection) return;

    function reposition() {
      setSelection(captureSelection(window.getSelection()));
    }

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [selection]);

  return { selection: dismissed ? null : selection, clear };
}
