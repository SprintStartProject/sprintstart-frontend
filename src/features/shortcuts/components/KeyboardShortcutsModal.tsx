import { Fragment } from "react";
import { Modal } from "../../../components/ui/Modal";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useProjectContext } from "../../projects/useProjectContext";
import { SHORTCUTS, shortcutChord, type ShortcutCategory } from "../shortcuts";

/** Reading order of the help — the registry's own order inside each group. */
const CATEGORY_ORDER: readonly ShortcutCategory[] = ["Navigation", "Actions", "General"];

/**
 * One chord as separate key caps, the way every shortcuts dialog draws them.
 *
 * Readable text rather than `aria-hidden` like the hover hint: this view exists to be
 * read, and "Alt + H" read out as a chord is exactly what a screen-reader user came for.
 */
function ChordKeys({ chord }: { chord: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {chord.split(" + ").map((key, index) => (
        <Fragment key={`${index}-${key}`}>
          {index > 0 && <span className="text-xs leading-none text-app-text-subtle">+</span>}

          <kbd className="rounded-md border border-app-border bg-app-surface-muted px-1.5 py-0.5 font-mono text-xs leading-none text-app-text">
            {key}
          </kbd>
        </Fragment>
      ))}
    </span>
  );
}

type KeyboardShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * The whole keyboard in one dialog, grouped by what the keys are for.
 *
 * Every row comes out of the one registry the listeners match against
 * (`features/shortcuts/shortcuts.ts`), so this view cannot document a chord the app does
 * not answer or miss one it does. Destination rows are gated with `canAccessRoute` exactly
 * as the listener and the sidebar are: a shortcut a profile may not use is not advertised
 * to them.
 *
 * Opened with `?` from `GlobalShortcuts`; the focus trap, Escape handling and focus
 * restoration are `ui/Modal`'s.
 */
export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { profile } = useAuth();
  const { canManageSelected } = useProjectContext();

  const visibleShortcuts = SHORTCUTS.filter(
    (shortcut) => !shortcut.path || canAccessRoute(profile, shortcut.path, canManageSelected),
  );

  return (
    <Modal
      isOpen={isOpen}
      title="Keyboard shortcuts"
      description="Press ? anywhere outside a text field to open this list again."
      size="lg"
      testId="keyboard-shortcuts"
      onClose={onClose}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const shortcuts = visibleShortcuts.filter((shortcut) => shortcut.category === category);
          if (shortcuts.length === 0) return null;

          return (
            <section key={category}>
              <h3 className="text-[10px] font-semibold tracking-[0.18em] text-app-text-muted uppercase">
                {category}
              </h3>

              <ul className="mt-3 space-y-2.5">
                {shortcuts.map((shortcut) => (
                  <li key={shortcut.id} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-app-text">
                      {shortcut.label}
                      {shortcut.note ? (
                        <span className="text-app-text-subtle"> — {shortcut.note}</span>
                      ) : null}
                    </span>

                    <ChordKeys chord={shortcutChord(shortcut)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
