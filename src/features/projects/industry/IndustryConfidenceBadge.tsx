import { Badge, type BadgeSize, type BadgeVariant } from "../../../components/ui/Badge";
import type { IndustryConfidence } from "../../../services/projectService";

// `low` deliberately uses `orange` rather than `warning` — the warning
// token's text color reads as too bright/yellow at this badge's small size.
const CONFIDENCE_VARIANT: Record<IndustryConfidence, BadgeVariant> = {
  high: "success",
  medium: "brand",
  low: "orange",
};

const CONFIDENCE_LABEL: Record<IndustryConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

type IndustryConfidenceBadgeProps = {
  confidence: IndustryConfidence | null;
  size?: BadgeSize;
};

/** `null` renders nothing — there is no confidence to show for an undetermined industry. */
export function IndustryConfidenceBadge({ confidence, size }: IndustryConfidenceBadgeProps) {
  if (!confidence) return null;

  return (
    <Badge variant={CONFIDENCE_VARIANT[confidence]} size={size}>
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}
