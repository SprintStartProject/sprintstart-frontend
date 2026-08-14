import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeSize } from "../../../components/ui/Badge";
import type { FAQTrend } from "../types";

/**
 * How the trend reads on the panel.
 *
 * "Rising" is the useful signal — a topic people are asking about more than
 * they were, i.e. where documentation effort pays off now — so it gets the
 * emphasis. "Fading" is deliberately neutral rather than a warning: a question
 * going quiet is usually a question that got answered, not a problem.
 */
const trendDisplay: Record<FAQTrend, { label: string; variant: "warning" | "neutral"; icon: typeof Minus }> = {
  RISING: { label: "Rising", variant: "warning", icon: TrendingUp },
  STEADY: { label: "Steady", variant: "neutral", icon: Minus },
  FADING: { label: "Quiet", variant: "neutral", icon: TrendingDown },
};

export interface TrendBadgeProps {
  trend: FAQTrend;
  /** Questions in the current window, shown alongside the label when given. */
  recentCount?: number;
  size?: BadgeSize;
  className?: string;
}

/**
 * Says which way a group's or category's volume is moving.
 *
 * The count is what the badge is really for: "Rising" alone invites the
 * question "from what?", and the window count answers it without the reader
 * having to open anything.
 */
export function TrendBadge({ trend, recentCount, size = "sm", className }: TrendBadgeProps) {
  const { label, variant, icon: Icon } = trendDisplay[trend];

  return (
    <Badge variant={variant} size={size} className={`gap-1 ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {recentCount === undefined ? label : `${label} · ${recentCount}`}
    </Badge>
  );
}
