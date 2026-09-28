import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import { SHORTCUTS, isShortcutPress } from "../shortcuts";

/**
 * A modal surface owns the keyboard while it is up, so no global chord may act behind one:
 * navigating off a half-filled dialog would unmount it mid-edit, and the help would stack a
 * second overlay on the first with one Escape closing both.
 *
 * `aria-modal="true"` is the precise line. `ui/Modal` (dialogs and alert dialogs), the canvas
 * covers, the side panel and the celebration overlays all set it; the buddy dock and the
 * popover-style popups deliberately do not, because they are non-modal by design — treating
 * those as keyboard owners would freeze every chord for as long as the dock stayed open.
 */
const MODAL_SURFACE_SELECTOR = '[aria-modal="true"]';

export type GlobalShortcutsState = {
  isHelpOpen: boolean;
  closeHelp: () => void;
};

/**
 * The shortcuts layer's own chords: every `scope: "global"` entry — the seven destinations
 * and `?`.
 *
 * Mounted from the signed-in shell, so nothing is bound on the login screen. Destination
 * chords go through `canAccessRoute` exactly as the sidebar entries and `ManagerAreaGuard`
 * do: a chord is a convenience, never a way around the access policy — a hire pressing
 * `Alt+P` is refused like a hire typing the URL.
 *
 * The `scope: "surface"` items are deliberately not here. Their owners answer them
 * (`useShortcutListener`), and nothing about this hook knows the sidebar's drawer exists.
 */
export function useGlobalShortcuts(): GlobalShortcutsState {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManageSelected } = useProjectContext();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      for (const shortcut of SHORTCUTS) {
        if (shortcut.scope !== "global") continue;
        if (!isShortcutPress(event, shortcut)) continue;

        // Matched, so the keystroke belongs to the app from here on: consuming it keeps the
        // browser's own accelerator — and anything else listening — out of a vocabulary the
        // app owns, whether or not this profile may go where the chord points.
        event.preventDefault();

        // A modal surface is up: no chord acts behind it (see MODAL_SURFACE_SELECTOR).
        if (document.querySelector(MODAL_SURFACE_SELECTOR)) return;

        if (shortcut.path) {
          if (!canAccessRoute(profile, shortcut.path, canManageSelected)) return;

          void navigate(shortcut.path);
          return;
        }

        if (shortcut.id === "gen-shortcuts") {
          setIsHelpOpen(true);
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canManageSelected, navigate, profile]);

  return { isHelpOpen, closeHelp };
}
