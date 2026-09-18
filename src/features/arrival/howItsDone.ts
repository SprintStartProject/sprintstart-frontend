import { CheckCircle2, Eye, GitBranch, GitPullRequest, type LucideIcon } from "lucide-react";
import type { Rigor } from "./types";

export type HowItsDone = {
  label: string;
  icon: LucideIcon;
};

/**
 * One sentence for how a step actually gets settled, so the list says it once instead of stacking
 * two badges ("We check this" plus "Hire can't tick it") that nobody without this file's context
 * could read correctly.
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
    return { label: "Done once GitHub confirms their username", icon: GitBranch };
  }
  if (step.key === "environment-ready") {
    return {
      label: "Done when they tick it, or with their first pull request",
      icon: GitPullRequest,
    };
  }
  if (step.settledBy === "OBSERVED") {
    return step.selfConfirmable
      ? { label: "Checked by SprintStart, or ticked by them", icon: Eye }
      : { label: "Checked by SprintStart only", icon: Eye };
  }
  return { label: "They tick it off themselves", icon: CheckCircle2 };
}
