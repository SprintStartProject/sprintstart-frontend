import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";

/**
 * The shortcuts layer: one window listener for every app-wide chord, and the help it opens.
 *
 * Mounted once from the signed-in shell — chords are only worth having because they work
 * without knowing where you are, which is the opposite of mounting a listener per page.
 * Rendering nothing on its own: the help goes through `ui/Modal`'s portal.
 */
export function GlobalShortcuts() {
  const { isHelpOpen, closeHelp } = useGlobalShortcuts();

  return <KeyboardShortcutsModal isOpen={isHelpOpen} onClose={closeHelp} />;
}
