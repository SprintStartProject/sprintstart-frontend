import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import { SHORTCUTS, isShortcutPress } from "../shortcuts";

/**
 * Open dialogs own the keyboard while they are up, so the help must not stack on top of
 * one: two `z-50` overlays appear at once and a single Escape closes both. `?` is simply
 * ignored while anything dialog-shaped is open — including this help itself.
 */
const OPEN_DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

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

        if (shortcut.path) {
          // Spoken for either way: a chord the profile may not use does nothing, rather
          // than falling through to whatever else might be listening.
          if (!canAccessRoute(profile, shortcut.path, canManageSelected)) return;

          event.preventDefault();
          void navigate(shortcut.path);
          return;
        }

        if (shortcut.id === "gen-shortcuts") {
          if (document.querySelector(OPEN_DIALOG_SELECTOR)) return;

          event.preventDefault();
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
