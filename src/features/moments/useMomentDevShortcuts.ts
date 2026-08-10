// ============================================================================
// TEMPORARY — REMOVE BEFORE MERGING TO dev
//
// A tuning aid, not a feature. Delete this file, its call in `MomentsProvider`,
// and the shortcut table from any docs once the moments are signed off.
// ============================================================================

import { useEffect } from "react";
import type { CelebrationInput } from "./types.ts";

interface DevShortcutHandlers {
  celebrate: (input: CelebrationInput) => void;
  flyby: () => void;
  completeMission: () => void;
  playLaunchSequence: () => void;
}

/** Physical key -> which moment it fires. */
const CHORDS = ["Digit4", "Digit5", "Digit6", "Digit7"] as const;

/**
 * Keyboard chords for triggering each moment on demand, in development only.
 *
 * These moments are gated behind real progress — the finale in particular only
 * fires once a user has cleared every phase of their onboarding path, which is
 * not something anyone can reasonably redo to check whether a 200ms delay feels
 * right. Without a way in, tuning them means guessing.
 *
 * | Chord          | Moment                     |
 * | -------------- | -------------------------- |
 * | Ctrl+Shift+4   | step flyby                 |
 * | Ctrl+Shift+5   | phase cleared (with ring)  |
 * | Ctrl+Shift+6   | onboarding finale          |
 * | Ctrl+Shift+7   | login launch sequence      |
 *
 * Digits continue the existing easter-egg chords (Ctrl+Shift+1/2/3 for the
 * dino, 2048 and Space Invaders) rather than starting a second scheme on
 * letters — and letter chords collide with browser and IDE bindings, which is
 * how a shortcut ends up looking broken when the handler is fine.
 *
 * Matched on `event.code` for the same reason the game shortcuts do: with Shift
 * held, `event.key` is the produced character, so Shift+4 is "$" on US QWERTY
 * and "4" nowhere useful. `Digit4` is layout-stable.
 *
 * The whole body compiles out of production builds — `import.meta.env.DEV` is a
 * literal at build time, so this ships nothing to real users.
 */
export function useMomentDevShortcuts({
  celebrate,
  flyby,
  completeMission,
  playLaunchSequence,
}: DevShortcutHandlers) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const isTypingTarget = (element: Element | null) =>
      element instanceof HTMLElement &&
      (element.tagName === "TEXTAREA" || element.tagName === "INPUT" || element.isContentEditable);

    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey || !event.shiftKey || event.repeat) return;
      if (!CHORDS.includes(event.code as (typeof CHORDS)[number])) return;
      if (isTypingTarget(document.activeElement)) return;

      event.preventDefault();

      switch (event.code) {
        case "Digit4":
          flyby();
          break;
        case "Digit5":
          celebrate({
            tone: "milestone",
            title: "Phase cleared",
            message: "Dev preview — this is what clearing a mid-path phase looks like.",
            progress: { current: 2, total: 5 },
          });
          break;
        case "Digit6":
          completeMission();
          break;
        case "Digit7":
          playLaunchSequence();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [celebrate, flyby, completeMission, playLaunchSequence]);
}
