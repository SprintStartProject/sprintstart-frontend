import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { OnboardingStepEndpoint } from "../types";

type StepOriginBadgeProps = {
  step: OnboardingStepEndpoint;
};

/**
 * Where a step came from, said on the card.
 *
 * It used to read this off `isAiAssisted`, which has two values and three answers to give: anything
 * not AI-generated was labelled "Custom step by PM", so a step the hire wrote themselves — and later
 * a step their buddy proposed — both arrived claiming the team had prescribed it. A hire who cannot
 * tell what their team requires from what they agreed to in a chat has lost the distinction this
 * badge exists for.
 *
 * A generated step wears nothing. It is the ordinary case, and the whole path would otherwise carry
 * the same badge on every card, which is a label for the page rather than for a step.
 *
 * **The `isAiAssisted` fallback stays** for rows written before `origin` existed: those default to
 * `GENERATED` in the database while `isAiAssisted` still records that a person authored them. Their
 * badge is the one they have always had.
 */
export function StepOriginBadge({ step }: StepOriginBadgeProps) {
  if (step.origin === "BUDDY") {
    return (
      <Badge variant="brand" className="gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        Added with your buddy
      </Badge>
    );
  }

  if (step.origin === "HIRE") {
    return (
      <Badge variant="neutral" className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        You added this
      </Badge>
    );
  }

  // PM, or a pre-`origin` row that a person authored.
  if (step.origin === "PM" || step.isAiAssisted === false) {
    return (
      <Badge variant="brand" className="gap-1.5">
        <UserRound className="h-3.5 w-3.5" />
        Custom step by PM
      </Badge>
    );
  }

  return null;
}
