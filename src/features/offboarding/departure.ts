import type { RiskQuery } from "../../services/offboardingTypes";

/** How many files a ranking lists; the summary counts all of them. */
export const RISK_LIST_LIMIT = 200;

/**
 * Splits what somebody typed or pasted into the identities in it: separated by commas, spaces or
 * lines, trimmed, in the order given and without repeats (an email and a login differ only by
 * letter case are the same identity).
 */
export function parsePeople(raw: string): string[] {
  const seen = new Set<string>();
  const people: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const person = part.trim();
    if (person && !seen.has(person.toLowerCase())) {
      seen.add(person.toLowerCase());
      people.push(person);
    }
  }
  return people;
}

/** The moment a calendar day ends, so a departure "as of 2026-11-20" includes that whole day. */
export function endOfDay(date: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59Z` : undefined;
}

/** What somebody entered to describe a departure, as the form holds it. */
export interface DepartureDraft {
  people: string[];
  /** A calendar day (`yyyy-mm-dd`), or empty for now. */
  asOfDay: string;
  /** A weight for reviews as typed, or empty to leave reviews out. */
  reviewWeight: string;
}

/** Why a draft cannot be ranked yet, or `null` when it can. */
export function draftProblem(draft: DepartureDraft): string | null {
  if (draft.people.length === 0) return "Name at least one person who is leaving.";
  const weight = parseWeight(draft.reviewWeight);
  if (weight !== undefined && !(weight >= 0)) return "The review weight must be a number from 0.";
  return null;
}

function parseWeight(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw);
}

/** The request a draft stands for. Call only when {@link draftProblem} is `null`. */
export function toRiskQuery(draft: DepartureDraft): RiskQuery {
  return {
    leaving: draft.people,
    asOf: endOfDay(draft.asOfDay),
    reviewWeight: parseWeight(draft.reviewWeight),
    limit: RISK_LIST_LIMIT,
  };
}
