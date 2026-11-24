import { SpotlightCard } from "../../../../components/ui/SpotlightCard";
import { parseCandidateSource, stripRedundantIssuePrefix } from "../../sourceId";
import { closedLineFor } from "./poolRules";
import { PoolLeadingMarker, PoolTaskBadges, PoolTaskSourceBadge } from "./PoolTaskParts";
import type { PoolTaskProps } from "./poolTypes";

function CardSummary({
  closedLine,
  description,
}: {
  closedLine: string | null;
  description: string | undefined;
}) {
  if (closedLine) {
    return (
      <p className="line-clamp-1 text-xs leading-relaxed text-app-text-subtle">{closedLine}</p>
    );
  }
  if (!description) return null;
  return (
    <p className="line-clamp-1 text-xs leading-relaxed text-app-text-muted" title={description}>
      {description}
    </p>
  );
}

/** A cloud card whose stretched button makes the entire surface open the task's detail drawer. */
export function PoolCloudCard({ task, onOpen, closed = false }: PoolTaskProps) {
  const unseen = !closed && !task.reviewed;
  const description = task.summary?.trim();
  const closedLine = closed ? closedLineFor(task) : null;
  const displayTitle = stripRedundantIssuePrefix(
    task.title,
    parseCandidateSource(task.sourceId).numberLabel,
  );

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      className={`transition-shadow hover:shadow-xl ${
        unseen ? "border-dashed border-app-border-muted" : ""
      } ${closed ? "opacity-70" : ""}`}
    >
      {/* A soft always-on glow, not the mouse-tracked spotlight — the cue that this one is new has
          to read before the reader's cursor ever reaches it. */}
      {unseen && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -left-10 z-0 h-28 w-28 rounded-full bg-app-brand/25 blur-2xl"
        />
      )}

      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open details for ${task.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-ring-inset"
      />

      <article className="pointer-events-none relative z-10 flex h-full flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <PoolTaskSourceBadge task={task} />
          <PoolLeadingMarker closed={closed} unseen={unseen} />
        </div>

        <h3
          className="line-clamp-2 text-sm leading-snug font-semibold text-app-text"
          title={task.title}
        >
          {displayTitle}
        </h3>

        <CardSummary closedLine={closedLine} description={description} />

        <div className="mt-auto pt-0.5">
          <PoolTaskBadges task={task} />
        </div>
      </article>
    </SpotlightCard>
  );
}
