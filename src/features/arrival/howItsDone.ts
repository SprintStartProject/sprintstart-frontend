import { CheckCircle2, Eye, GitBranch, GitPullRequest, type LucideIcon } from "lucide-react";
import type { Rigor } from "./types";

export type HowItsDone = {
  /** One or two words for the badge — see the "What the badges mean" hint for the full sentence. */
  badge: string;
  /** The full sentence, used wherever there is room to spell it out (edit drawer, add-step wizard). */
  label: string;
  icon: LucideIcon;
};

/**
 * How a step actually gets settled, so the list says it once instead of stacking two badges
 * ("We check this" plus "Hire can't tick it") that nobody without this file's context could read
 * correctly.
 *
 * `badge` is deliberately terse — a card row only has room for a word or two — and is never the
 * only place the meaning lives: `label` carries the full sentence for the edit drawer and the
 * add-step wizard, and the arrival section's "What the badges mean" hint spells out every word.
 *
 * The two derivations get their own wording because "checked automatically" is true of both but
 * says nothing a PM couldn't already guess — what they cannot guess is *what* gets checked, so
 * those two name it. Every other step falls back to what `settledBy`/`selfConfirmable` already say.
 */
export function howStepGetsDone(step: {
  key: string;
  settledBy: Rigor;
  selfConfirmable: boolean;
}): HowItsDone {
  if (step.key === "github-account") {
    return {
      badge: "GitHub",
      label: "Done once GitHub confirms their username",
      icon: GitBranch,
    };
  }
  if (step.key === "environment-ready") {
    return {
      badge: "First PR",
      label: "Done when they tick it, or with their first pull request",
      icon: GitPullRequest,
    };
  }
  if (step.settledBy === "OBSERVED") {
    return step.selfConfirmable
      ? { badge: "Auto or tick", label: "Checked by SprintStart, or ticked by them", icon: Eye }
      : { badge: "Auto only", label: "Checked by SprintStart only", icon: Eye };
  }
  return { badge: "Self-tick", label: "They tick it off themselves", icon: CheckCircle2 };
}
