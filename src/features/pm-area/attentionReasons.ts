import { Clock, Hourglass, MessageSquareText, SkipForward, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AttentionReasonKind } from "./attentionQueue";

/**
 * How each reason someone needs the manager is drawn — icon, colour, short label — wherever it
 * shows: the overview's "Needs you" and the team roster's "Open with you" column alike.
 */
export const REASON_META: Record<
  AttentionReasonKind,
  { icon: LucideIcon; tone: string; label: string }
> = {
  skip: {
    icon: SkipForward,
    tone: "bg-app-warning-bg text-app-warning-text",
    label: "Skip request",
  },
  feedback: {
    icon: MessageSquareText,
    tone: "bg-app-brand-soft text-app-brand-text",
    label: "Feedback",
  },
  "waiting-review": {
    icon: Hourglass,
    tone: "bg-app-orange-bg text-app-orange-text",
    label: "Waiting on review",
  },
  drifting: {
    icon: TrendingDown,
    tone: "bg-app-danger-bg text-app-danger-text",
    label: "Drifting",
  },
  stuck: { icon: Clock, tone: "bg-app-orange-bg text-app-orange-text", label: "Long on a step" },
};
