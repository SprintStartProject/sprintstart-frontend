/**
 * What one unit of a hire's accepted work is called, and how their own act reads.
 *
 * Fixed, because every hire onboards as an engineer. Mirrors the backend's `ContributionWording`:
 * the words are not sent per hire, so both ends simply agree on them.
 *
 * Bare noun: it is always rendered next to `VERB_PAST` — "merged change" — and baking the verb
 * into the noun produces "merged merged change" the moment a sentence needs both.
 */
export const CONTRIBUTION_WORDING = {
  noun: "change",
  nounPlural: "changes",
  verbPast: "merged",
} as const;
