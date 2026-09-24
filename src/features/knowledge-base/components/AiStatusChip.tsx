import { Badge } from "../../../components/ui/Badge";
import { AI_STATUS_CHIPS } from "../aiStatus";
import type { ArtifactAiStatus } from "../types";

/** Props for {@link AiStatusChip}. */
export interface AiStatusChipProps {
  status: ArtifactAiStatus;
}

/**
 * The AI assistant's index status for one artifact, as icon + text + colour.
 *
 * Sits inside the card's `role="button"`, whose children are presentational, so the spoken form
 * travels in the card's aria-label (see {@link AI_STATUS_CHIPS}) and the icon is hidden here.
 */
export function AiStatusChip({ status }: AiStatusChipProps) {
  const chip = AI_STATUS_CHIPS[status];
  const Icon = chip.icon;
  return (
    <span className="shrink-0" data-testid="artifact-ai-status" data-status={status}>
      <Badge variant={chip.variant} size="sm" title={chip.meaning} className="gap-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {chip.label}
      </Badge>
    </span>
  );
}
