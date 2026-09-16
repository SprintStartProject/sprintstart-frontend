import type { LucideIcon } from "lucide-react";
import { GitMerge, GitPullRequest, Hand, MessageSquare, UserPlus } from "lucide-react";
import { CONTRIBUTION_WORDING } from "../../config/contributionWording";
import type { HireTimeline } from "./types";

export type HireMoment = { label: string; at: string | null; icon: LucideIcon };

/** Track nouns arrive bare ("change", "facilitated") so a slot at the start of a label capitalises. */
function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A hire's five moments, joined → accepted, named from the hire's own track.
 *
 * Shared by the timeline card and the member side panel, so the two can never order or name
 * the moments differently.
 */
export function hireMoments(hire: HireTimeline): HireMoment[] {
  return [
    { label: "Joined", at: hire.joinedAt, icon: UserPlus },
    { label: "Task claimed", at: hire.firstTaskClaimedAt, icon: Hand },
    {
      label: `${capitalise(CONTRIBUTION_WORDING.noun)} started`,
      at: hire.firstContributionOpenedAt,
      icon: GitPullRequest,
    },
    { label: "First response", at: hire.firstResponseAt, icon: MessageSquare },
    {
      label: capitalise(CONTRIBUTION_WORDING.verbPast),
      at: hire.firstContributionAcceptedAt,
      icon: GitMerge,
    },
  ];
}

/** Hours between two moments, when both have happened. */
export function gapHours(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60));
}
