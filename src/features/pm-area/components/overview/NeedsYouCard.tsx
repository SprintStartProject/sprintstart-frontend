import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Hourglass,
  Inbox,
  MessageSquareText,
  SkipForward,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserAvatar } from "../../../../components/common/UserAvatar";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import type { AttentionEntry, AttentionReasonKind } from "../../attentionQueue";
import { PmCard, PmCardHeader, PmCardLink } from "../PmCard";

const REASON_META: Record<AttentionReasonKind, { icon: LucideIcon; tone: string; label: string }> =
  {
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

/** How many people the card lists before it hands over to the team page. */
const VISIBLE_ENTRIES = 6;

type NeedsYouCardProps = {
  entries: AttentionEntry[];
  loading: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * The first thing on the overview: who needs the manager, and why, in one list.
 *
 * Every row opens the member panel, where the skip can be decided or the feedback read without
 * leaving the dashboard.
 */
export function NeedsYouCard({ entries, loading, onOpenMember }: NeedsYouCardProps) {
  const visible = entries.slice(0, VISIBLE_ENTRIES);
  const hidden = entries.length - visible.length;

  return (
    <PmCard aria-label="Needs you" className="h-full">
      <PmCardHeader
        icon={Inbox}
        title="Needs you"
        help="Everyone who needs a move from you, most urgent first: skip requests, unread feedback, work waiting 2+ days for a review, hires with no visible progress yet, and anyone on the same step for 5+ days."
        meta={loading ? undefined : entries.length === 1 ? "1 person" : `${entries.length} people`}
        action={
          <PmCardLink to="/team-management?filter=attention">
            {hidden > 0 ? `All ${entries.length}` : "Team"}
          </PmCardLink>
        }
      />

      {loading ? (
        <SkeletonGroup label="Loading who needs you" className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonLine className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonLine className="w-1/3" />
                <SkeletonLine className="w-2/3" />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-app-success-bg text-app-success-text">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-app-text">All clear</p>
          <p className="max-w-xs text-xs text-app-text-muted">
            No skip requests, no unread feedback, and nobody stuck on a step.
          </p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {visible.map((entry) => {
            const [lead, ...rest] = entry.reasons;
            const LeadIcon = REASON_META[lead.kind].icon;

            return (
              <li key={entry.userId}>
                <button
                  type="button"
                  onClick={() => onOpenMember(entry.userId)}
                  className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  <span className="relative shrink-0">
                    <UserAvatar
                      profileIcon={entry.member?.profileIcon}
                      fallbackName={entry.name}
                      seed={entry.userId}
                      size={36}
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-app-surface ${REASON_META[lead.kind].tone}`}
                    >
                      <LeadIcon className="h-3 w-3" />
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-app-text">
                        {entry.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${REASON_META[lead.kind].tone}`}
                      >
                        {REASON_META[lead.kind].label}
                      </span>
                      {rest.length > 0 && (
                        <span className="shrink-0 text-[11px] text-app-text-muted">
                          +{rest.length}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-app-text-muted">
                      {lead.text}
                    </span>
                  </span>

                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-app-text"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PmCard>
  );
}
