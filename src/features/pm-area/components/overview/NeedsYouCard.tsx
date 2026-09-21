import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock,
  Hourglass,
  MessageSquareText,
  SkipForward,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserAvatar } from "../../../../components/common/UserAvatar";
import { SkeletonGroup, SkeletonLine } from "../../../../components/ui/Skeleton";
import { isWaitingOnAnswer } from "../../attentionQueue";
import type { AttentionEntry, AttentionReasonKind } from "../../attentionQueue";
import { PmCard, PmCardHeader, PmCardLink, PmEyebrow } from "../PmCard";

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

/**
 * How many people the card lists before it hands over to the team page. Kept short on purpose:
 * the card is a pointer at who to look at first, and the Team card beside it gets the width.
 */
const VISIBLE_ENTRIES = 5;

type NeedsYouCardProps = {
  entries: AttentionEntry[];
  loading: boolean;
  onOpenMember: (userId: string) => void;
};

/**
 * The first thing on the overview: who needs the manager, and why, in one list.
 *
 * Split in two, because the two halves ask different things of the manager: **waiting on your
 * answer** (a skip to decide, feedback to read — the "Waiting on you" figure above counts exactly
 * these) and **worth a check-in** (a review nobody picked up, drifting, a long step), where
 * nobody is blocked on a click but a conversation would help. One list of both hid that.
 *
 * Every row opens the member panel, where the skip can be decided or the feedback read without
 * leaving the dashboard; the rest of the card opens the team filtered to these people.
 */
function EntryRow({
  entry,
  onOpenMember,
}: {
  entry: AttentionEntry;
  onOpenMember: (userId: string) => void;
}) {
  const [lead, ...rest] = entry.reasons;
  const meta = REASON_META[lead.kind];
  const LeadIcon = meta.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenMember(entry.userId)}
        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <span className="relative shrink-0">
          <UserAvatar
            profileIcon={entry.member?.profileIcon}
            fallbackName={entry.name}
            seed={entry.userId}
            size={32}
          />
          <span
            aria-hidden="true"
            className={`absolute -right-1 -bottom-1 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-app-surface ${meta.tone}`}
          >
            <LeadIcon className="h-2.5 w-2.5" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-app-text">{entry.name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}
            >
              {meta.label}
            </span>
            {rest.length > 0 && (
              <span
                className="shrink-0 text-[11px] text-app-text-muted"
                title={rest.map((reason) => REASON_META[reason.kind].label).join(", ")}
              >
                +{rest.length}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-app-text-muted">{lead.text}</span>
        </span>

        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-app-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-app-text"
        />
      </button>
    </li>
  );
}

export function NeedsYouCard({ entries, loading, onOpenMember }: NeedsYouCardProps) {
  const visible = entries.slice(0, VISIBLE_ENTRIES);
  const hidden = entries.length - visible.length;

  // The queue is sorted most pressing first, so the answers already lead — the split only
  // decides where the second heading goes.
  const answers = visible.filter(isWaitingOnAnswer);
  const checkIns = visible.filter((entry) => !isWaitingOnAnswer(entry));
  const answerTotal = entries.filter(isWaitingOnAnswer).length;

  return (
    <PmCard
      aria-label="Needs you"
      tone="warning"
      className="h-full"
      to="/team-management?filter=attention"
      linkLabel="Open everybody who needs you in the team"
    >
      <PmCardHeader
        icon={BellRing}
        tone="warning"
        title="Needs you"
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
              <SkeletonLine className="h-8 w-8 rounded-full" />
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
        <div className="space-y-3">
          {answers.length > 0 && (
            <div>
              <PmEyebrow className="mb-1 flex items-center justify-between text-app-warning-text!">
                <span>Waiting on your answer</span>
                <span className="tabular-nums">{answerTotal}</span>
              </PmEyebrow>
              <ul className="-mx-2 space-y-0.5">
                {answers.map((entry) => (
                  <EntryRow key={entry.userId} entry={entry} onOpenMember={onOpenMember} />
                ))}
              </ul>
            </div>
          )}
          {checkIns.length > 0 && (
            <div>
              <PmEyebrow className="mb-1 flex items-center justify-between text-app-text-subtle!">
                <span>Worth a check-in</span>
                <span className="tabular-nums">{entries.length - answerTotal}</span>
              </PmEyebrow>
              <ul className="-mx-2 space-y-0.5">
                {checkIns.map((entry) => (
                  <EntryRow key={entry.userId} entry={entry} onOpenMember={onOpenMember} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PmCard>
  );
}
