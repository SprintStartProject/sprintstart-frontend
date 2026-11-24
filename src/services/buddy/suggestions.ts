import { apiClient } from "../apiClient";

/** One suggested next step attached to a buddy greeting — one click sends `question`. */
export interface BuddyOpeningAction {
  label: string;
  question: string;
}

/**
 * One thing this hire could usefully ask, offered as a chip beside the composer.
 *
 * `question` goes into the composer; it is never sent. The hire presses send. A chip that
 * spoke for somebody would be putting words in their mouth, which is the same rule `AskTheBuddy`
 * keeps for the board.
 */
export interface BuddySuggestion {
  label: string;
  question: string;
}

/**
 * What this hire could usefully ask, drawn server-side from the tools actually mounted for them —
 * so a chip is never offered for something their buddy cannot answer. Calls no model, so a surface
 * can show these before a greeting has arrived.
 */
export async function getSuggestions(): Promise<BuddySuggestion[]> {
  return await apiClient.fetch<BuddySuggestion[]>(`/api/v1/onboarding/me/buddy/suggestions`);
}
