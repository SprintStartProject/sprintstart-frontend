import type { SkillSuggestion } from "../../services/teamManagementTypes";

/** Stable identity for suggestions that do not have a catalog ID yet. */
export function skillSuggestionKey(suggestion: SkillSuggestion): string {
  return suggestion.skillId ?? `new:${suggestion.name.trim().toLocaleLowerCase()}`;
}
