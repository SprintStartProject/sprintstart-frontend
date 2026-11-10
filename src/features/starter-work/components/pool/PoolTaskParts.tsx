import type { LucideIcon } from "lucide-react";
import { Archive, CheckCircle2, GitBranch, PenLine, Ticket, UserRound } from "lucide-react";
import { Badge, type BadgeVariant } from "../../../../components/ui/Badge";
import { SkeletonBlock, SkeletonLine } from "../../../../components/ui/Skeleton";
import { parseCandidateSource, trackerLabel } from "../../sourceId";
import type { StarterWorkTask } from "../../../../services/starterWorkTypes";

/** Placeholder for one pool row, matching `PoolListRow`'s marker/title/description/badge shape. */
export function PoolRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <SkeletonBlock className="h-2 w-2 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="mt-1.5 w-1/2" />
      </div>
      <SkeletonBlock className="h-5 w-16 shrink-0 rounded-full" />
    </div>
  );
}

/** Icon per known tracker, matching the icons Data Ingestion uses for the same systems. */
const TRACKER_ICONS: Record<string, LucideIcon> = {
  GITHUB: GitBranch,
  JIRA: Ticket,
};

/** Badge colour per known tracker, so a scan of the pool tells GitHub and Jira apart at a glance. */
const TRACKER_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  GITHUB: "brand",
  JIRA: "orange",
};

/**
 * Where a pool task came from, shared by the card, the list row, and — from here on — anything
 * else that shows a pool task. A known tracker reads as one small coloured badge (its number or
 * key, never the full path — that stays in the tooltip and the drawer, where there is room for
 * it), so every card carries at least a touch of colour instead of reading as pure grayscale.
 * A hand-authored task has no tracker to colour, so it stays a plain muted line.
 */
export function PoolTaskSourceBadge({ task }: { task: StarterWorkTask }) {
  const parsed = parseCandidateSource(task.sourceId);

  if (!parsed.hasKnownTracker) {
    return (
      <span className="flex w-fit min-w-0 shrink-0 items-center gap-1.5 self-center text-xs text-app-text-subtle">
        <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Written by hand</span>
      </span>
    );
  }

  const Icon = TRACKER_ICONS[parsed.trackerCode.toUpperCase()];
  const variant = TRACKER_BADGE_VARIANTS[parsed.trackerCode.toUpperCase()] ?? "brand";
  const identifier = parsed.numberLabel ?? trackerLabel(parsed.trackerCode);
  const fullSource =
    [parsed.repoLabel, parsed.numberLabel].filter(Boolean).join(" ") ||
    trackerLabel(parsed.trackerCode);

  return (
    <Badge
      variant={variant}
      size="md"
      title={fullSource}
      className="w-fit min-w-0 shrink gap-1 self-center"
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{identifier}</span>
    </Badge>
  );
}

/**
 * At most one badge for the state that most needs flagging: Task 0 first, then an assignee the
 * tracker already reports — never both, so a card carries the source badge above and one more
 * colour at most, rather than turning into a row of pills. Renders nothing when neither applies.
 */
export function PoolTaskBadges({ task }: { task: StarterWorkTask }) {
  if (task.taskZeroEligible) {
    return (
      <Badge variant="purple" size="md" className="w-fit shrink-0 self-center">
        Task 0
      </Badge>
    );
  }

  // Only a definite `true` means somebody has this — `null` is "we don't know", not "nobody".
  if (task.sourceHasAssignee === true) {
    return (
      <Badge variant="neutral" size="md" className="w-fit shrink-0 gap-1 self-center">
        <UserRound className="h-3 w-3" aria-hidden="true" />
        Someone is on this
      </Badge>
    );
  }

  return null;
}

/**
 * Whether nobody has looked at this task yet (a pulsing dot) or somebody already has (a
 * checkmark) — the same distinction the pool has always drawn, just quieter than a full badge. The
 * pulse is a plain CSS animation, which the app's global `prefers-reduced-motion` rule already
 * collapses to a static dot.
 */
function PoolStatusMarker({ unseen }: { unseen: boolean }) {
  if (unseen) {
    return (
      <span className="relative flex h-2 w-2 shrink-0" role="img" aria-label="Not looked at yet">
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-app-brand opacity-75 motion-reduce:animate-none"
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-app-brand" />
      </span>
    );
  }

  return (
    <CheckCircle2
      role="img"
      aria-label="Looked at"
      className="h-4 w-4 shrink-0 text-app-success-text"
    />
  );
}

/** The archive icon for a closed task, otherwise the unseen/seen marker. */
export function PoolLeadingMarker({ closed, unseen }: { closed: boolean; unseen: boolean }) {
  if (!closed) return <PoolStatusMarker unseen={unseen} />;
  return (
    <Archive
      role="img"
      aria-label="Closed in the tracker"
      className="h-4 w-4 shrink-0 text-app-text-subtle"
    />
  );
}
