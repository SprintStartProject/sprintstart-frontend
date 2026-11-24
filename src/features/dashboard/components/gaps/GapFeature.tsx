import { Clock } from "lucide-react";
import { formatRelativeDate, SEVERITY_STYLES } from "./gapsKit";
import type { KnowledgeGap } from "./gapsKit";
import { coOwnerNames, firstIngestedOf, missingLabel, PRESENT_TYPE_COUNT } from "./gapRules";
import { ChipLabel, MissingTypes, SeverityPill } from "./gapParts";

const COLUMN_DIVIDER =
  "min-w-0 @min-[28rem]:flex-1 @min-[28rem]:border-l @min-[28rem]:border-app-border-muted @min-[28rem]:pl-8";

/**
 * A single gap given the whole card.
 *
 * Owning exactly one component is the common case, and the compact row built for a list of
 * four left most of a half- or full-width card empty. So one gap stops being a list of one
 * and becomes the subject: the name set large, every missing type spelled out rather than
 * capped at three, what the component *does* already have, and when it was last ingested.
 *
 * The extra content is real, not padding — `presentTypes` and the ingest date were already on
 * the response and were simply not being shown.
 *
 * Two columns from `sm` up, at both sizes. The rows are a hard 8.5rem, which leaves 196px of
 * body — and stacked, this content measures about that much before a chip row wraps, so it
 * would start clipping on the first component with three long document types. Side by side it
 * needs the height of its taller half and nothing more, and it spends the width the half- and
 * full-width cards actually have. It only stacks on a phone, where there is no width to split.
 *
 * `split` is then just the typography: the full-width card can carry a bigger name.
 */
export function GapFeature({
  gap,
  split,
  currentUserId,
}: {
  gap: KnowledgeGap;
  split: boolean;
  currentUserId: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3 @min-[28rem]:flex-row @min-[28rem]:items-center @min-[28rem]:gap-8">
      <FeatureSummary gap={gap} split={split} />
      <FeatureTypes gap={gap} />

      {/*
        A third column, only at full width and only for a lone gap — that is the one case with
        more space than content, and every line here was already on the response and simply
        never shown. Without it the right half of the widget sat empty.
      */}
      {split && <FeatureSource gap={gap} currentUserId={currentUserId} />}
    </div>
  );
}

function FeatureSummary({ gap, split }: { gap: KnowledgeGap; split: boolean }) {
  const { longLabel } = SEVERITY_STYLES[gap.severity];

  return (
    <div className="min-w-0 @min-[28rem]:flex-1">
      <SeverityPill gap={gap} />

      <p
        className={`mt-2 truncate leading-tight font-semibold text-app-text ${
          split ? "text-2xl" : "text-xl"
        }`}
      >
        {gap.component}
      </p>

      <p className="mt-1 text-xs text-app-text-muted">{missingLabel(gap.missingTypes.length)}</p>

      <p className="mt-1 text-xs text-app-text-muted">{longLabel}</p>

      {/* At full width this moves into the third column, where it has company. */}
      {!split && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-app-text-muted">
          <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Last ingested {formatRelativeDate(gap.lastIngested)}
        </p>
      )}
    </div>
  );
}

function FeatureTypes({ gap }: { gap: KnowledgeGap }) {
  const present = gap.presentTypes ?? [];

  return (
    <div className={COLUMN_DIVIDER}>
      <ChipLabel>Missing</ChipLabel>
      <MissingTypes types={gap.missingTypes} limit={gap.missingTypes.length} />

      {present.length > 0 && (
        <div className="mt-3">
          <ChipLabel>Already documented</ChipLabel>
          <MissingTypes types={present} limit={PRESENT_TYPE_COUNT} tone="present" />
        </div>
      )}
    </div>
  );
}

function FeatureSource({
  gap,
  currentUserId,
}: {
  gap: KnowledgeGap;
  currentUserId: string | null;
}) {
  const coOwners = coOwnerNames(gap, currentUserId);

  return (
    <div className={COLUMN_DIVIDER}>
      <ChipLabel>Source</ChipLabel>

      <dl className="space-y-1">
        <MetaRow label="First ingested" value={formatRelativeDate(firstIngestedOf(gap))} />
        <MetaRow label="Last ingested" value={formatRelativeDate(gap.lastIngested)} />
        <MetaRow label="Last analyzed" value={formatRelativeDate(gap.refreshedAt)} />
      </dl>

      {coOwners !== "" && (
        <div className="mt-3">
          <ChipLabel>Shared with</ChipLabel>
          <p className="truncate text-xs text-app-text">{coOwners}</p>
        </div>
      )}
    </div>
  );
}

/** One `label — value` line of the source column. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-xs text-app-text-muted">{label}</dt>
      <dd className="truncate text-xs font-medium text-app-text">{value}</dd>
    </div>
  );
}
