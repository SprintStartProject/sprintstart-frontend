import { useCallback, useState } from "react";
import { FOCUS_COMPOSER_SHORTCUT, useShortcutListener } from "../../features/shortcuts";

/**
 * `/` puts the caret in the composer — the chord the shortcut help lists for this page. Text fields
 * keep their own `/` (see `isShortcutPress`). The token changes each time, which is what the
 * composer watches.
 */
export function useComposerFocus(): number {
  const [token, setToken] = useState(0);
  const focus = useCallback(() => setToken((current) => current + 1), []);
  useShortcutListener(FOCUS_COMPOSER_SHORTCUT, focus);
  return token;
}
