import { CircleSlash, FileQuestion, Timer, TriangleAlert, type LucideIcon } from "lucide-react";
import type { OnboardingGenerationIssueEndpoint } from "./types.ts";

export type IssueStatus = OnboardingGenerationIssueEndpoint["status"];

/**
 * What each outcome means, and whether trying again can change it.
 *
 * The four were previously collapsed into one sentence — "empty, could not be assembled, or timed
 * out" — followed by every phase name and its status in a single comma-separated line. That reads
 * as one undifferentiated failure, and it hides the distinction that matters: two of these are
 * worth retrying and two are not, because nothing about the project has changed in between.
 */
export const ISSUE_EXPLANATIONS: Record<
  IssueStatus,
  { label: string; icon: LucideIcon; meaning: string; retryHelps: boolean }
> = {
  FAILED: {
    label: "Could not be reached",
    icon: TriangleAlert,
    meaning:
      "The service that writes these phases could not be reached, or answered with an error. Nothing about the project caused this.",
    retryHelps: true,
  },
  TIMED_OUT: {
    label: "Took too long",
    icon: Timer,
    meaning: "Assembly ran out of time. A second run often finishes.",
    retryHelps: true,
  },
  EMPTY: {
    label: "Came back empty",
    icon: FileQuestion,
    meaning: "Assembly finished but produced nothing the project's material could support.",
    retryHelps: false,
  },
  SKIPPED: {
    label: "Nothing to build from",
    icon: CircleSlash,
    meaning:
      "The project's own material does not cover this yet, and inventing it was refused. Adding the missing documents is what changes this — another run on its own will not.",
    retryHelps: false,
  },
};

/** The order they are worth reading in: what is broken first, what is merely missing last. */
const STATUS_ORDER: IssueStatus[] = ["FAILED", "TIMED_OUT", "EMPTY", "SKIPPED"];

/** The issues gathered by outcome, in reading order, with empty outcomes left out. */
export function groupIssues(issues: readonly OnboardingGenerationIssueEndpoint[]) {
  return STATUS_ORDER.map((status) => ({
    status,
    ...ISSUE_EXPLANATIONS[status],
    titles: issues.filter((issue) => issue.status === status).map((issue) => issue.title),
  })).filter((group) => group.titles.length > 0);
}

/** Whether trying again could plausibly change any of these outcomes. */
export function retryCouldHelp(issues: readonly OnboardingGenerationIssueEndpoint[]): boolean {
  return issues.some((issue) => ISSUE_EXPLANATIONS[issue.status].retryHelps);
}

/** The short name for one outcome, for places with room for a word and not a paragraph. */
export function issueStatusLabel(status: IssueStatus): string {
  return ISSUE_EXPLANATIONS[status].label;
}
