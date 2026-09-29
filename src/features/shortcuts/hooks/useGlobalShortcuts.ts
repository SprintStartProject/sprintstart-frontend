import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import { SHORTCUTS, isShortcutPress } from "../shortcuts";
import { isModalSurfaceOpen } from "../lib/modalSurface";

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

        // A modal surface is up: no chord acts behind or on top of it (see `modalSurface.ts`).
        if (isModalSurfaceOpen()) return;

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
