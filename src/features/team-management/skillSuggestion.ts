import type { SkillSuggestion } from "./types";

/** Stable identity for suggestions that do not have a catalog ID yet. */
export function skillSuggestionKey(suggestion: SkillSuggestion): string {
  return suggestion.skillId ?? `new:${suggestion.name.trim().toLocaleLowerCase()}`;
}
