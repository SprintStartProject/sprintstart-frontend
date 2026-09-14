import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { OnboardingStepEndpoint } from "../types";

type StepOriginBadgeProps = {
  step: OnboardingStepEndpoint;
  /**
   * Who is looking. The hire reads "you" and "your buddy"; a PM reviewing somebody else's path
   * would read those as being about themselves, so the reviewer view names the hire instead.
   */
  viewer?: "hire" | "reviewer";
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
 * **The `isAiAssisted` fallback stays**, for two kinds of step that arrive as `GENERATED` with
 * `isAiAssisted` false: a step copied from a blueprint step the PM wrote by hand (the copy keeps the
 * blueprint's flag), and a row written before `origin` existed. Both were authored by a person on
 * the team, and both keep the badge they have always had.
 */
export function StepOriginBadge({ step, viewer = "hire" }: StepOriginBadgeProps) {
  if (step.origin === "BUDDY") {
    return (
      <Badge variant="brand" className="gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        {viewer === "hire" ? "Added with your buddy" : "Added with the buddy"}
      </Badge>
    );
  }

  if (step.origin === "HIRE") {
    return (
      <Badge variant="neutral" className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        {viewer === "hire" ? "You added this" : "Added by the hire"}
      </Badge>
    );
  }

  // PM, or a hand-written blueprint copy or pre-`origin` row -- see above.
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
