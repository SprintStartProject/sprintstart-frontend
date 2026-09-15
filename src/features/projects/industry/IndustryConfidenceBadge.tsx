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
  /** Whether the industry was set by hand rather than detected by the AI. */
  isCustom?: boolean;
  size?: BadgeSize;
};

/**
 * `null` confidence renders nothing unless the industry is custom, in which case a
 * "Custom" badge takes its place — there is no AI confidence to show for a manually
 * set value, but it is still worth flagging that it did not come from an evaluation.
 */
export function IndustryConfidenceBadge({
  confidence,
  isCustom = false,
  size,
}: IndustryConfidenceBadgeProps) {
  if (isCustom) {
    return (
      <Badge variant="neutral" size={size}>
        Custom
      </Badge>
    );
  }

  if (!confidence) return null;

  return (
    <Badge variant={CONFIDENCE_VARIANT[confidence]} size={size}>
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}
