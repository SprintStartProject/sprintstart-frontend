/**
 * Recognized chat phrases → effect ids. Kept verbatim from ChatPage's old
 * inline matching so existing behaviour (and muscle memory) is unchanged:
 * {@link matchEggPhrase} trims/lowercases before comparing.
 *
 * "do barrel" exists because users abbreviate mid-thought; "matrix" alone
 * matches because asking the AI about the movie was nobody's actual intent.
 */
import type { EggEffectId } from "../eggEffectBus";
const EGG_PHRASES: ReadonlyArray<readonly [phrases: string[], effect: EggEffectId]> = [
  [["do a barrel roll", "do barrel roll", "do barrel"], "barrel-roll"],
  [["the matrix", "do matrix", "matrix"], "matrix"],
];

/** The whole-window easter eggs a chat surface can trigger by phrase. */
export type { EggEffectId } from "../eggEffectBus";

/**
 * Returns the easter-egg effect a submitted chat message should trigger,
 * or null when the text is a normal message.
 */
export function matchEggPhrase(text: string): EggEffectId | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  for (const [phrases, effect] of EGG_PHRASES) {
    if (phrases.includes(normalized)) return effect;
  }
  return null;
}
