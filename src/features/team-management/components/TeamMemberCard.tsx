import { Link } from "react-router-dom";
import { Check, Hourglass, MessageSquareText, SkipForward } from "lucide-react";
import type { TeamOverviewUser } from "../types";
import { Badge } from "../../../components/ui/Badge";
import { UserAvatar } from "../../../components/common/UserAvatar";

type TeamMemberCardProps = {
  user: TeamOverviewUser;
  /**
   * Renders a denser variant (smaller avatar/text/paddings, role hidden)
   * for tight spaces like the PM Dashboard widget grid, while the default
   * size is used on the full Team Management page.
   */
  compact?: boolean;
  /**
   * Puts the card into selection mode (used while assigning a role to
   * multiple members on the Team Management page): the card no longer
   * links to the member detail page, clicking it toggles selection
   * instead, and a check indicator plus a colored highlight show the
   * selected state.
   */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (userId: string) => void;
};

const AT_RISK_AFTER_DAYS = 5;

function getElapsedDays(startedAt: string): number {
  const started = new Date(startedAt).getTime();

  return Math.max(0, Math.floor((Date.now() - started) / (1000 * 60 * 60 * 24)));
}

export function TeamMemberCard({
  user,
  compact = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: TeamMemberCardProps) {
  const elapsedDays = user.currentStep?.startedAt ? getElapsedDays(user.currentStep.startedAt) : 0;

  const progressPercentage = Math.round(user.progressPercentage * 100);
  const isAtRisk = !!user.currentStep && elapsedDays > AT_RISK_AFTER_DAYS;

  const hasPendingSkipRequest = user.currentStep?.skip?.status === "PENDING";

  // Onboarding is complete once progress reaches 100% (kept in sync with the
  // percentage shown below). Reuses progressPercentage — no extra data needed.
  const isOnboardingComplete = progressPercentage >= 100;
  const onboardingStatusLabel = isOnboardingComplete
    ? "Onboarding completed"
    : "Onboarding in progress";

  // The magnification is a plain CSS transform rather than a Framer spring:
  // these cards render in grids of dozens, and a motion component per card
  // would put a JS-driven animation on every one of them. Tailwind v4's
  // `transition-all` covers the standalone `scale` property.
  const cardClassName = `group relative flex flex-col rounded-2xl border transition-all duration-200 motion-reduce:hover:scale-100 ${
    selectable ? "cursor-pointer" : ""
  } ${
    selected
      ? "border-app-brand bg-app-brand-soft ring-1 ring-app-brand"
      : "border-app-border bg-app-surface hover:scale-[1.02] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg"
  } ${compact ? "p-2" : "p-4"}`;

  const content = (
    <>
      <div
        className={`absolute flex items-center gap-1 ${
          compact ? "top-2 right-2" : "top-3 right-3 gap-1.5"
        }`}
      >
        {user.hasFeedback && (
          <span
            title="Unread onboarding feedback"
            className={`flex items-center justify-center rounded-full border border-app-warning-border bg-app-warning-bg text-app-warning-text shadow-sm ${
              compact ? "h-5 w-5" : "h-6 w-6"
            }`}
          >
            <MessageSquareText className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </span>
        )}

        {hasPendingSkipRequest && (
          <span
            title="Open skip request"
            className={`flex items-center justify-center rounded-full border border-app-danger-border bg-app-danger-bg text-app-danger-text shadow-sm ${
              compact ? "h-5 w-5" : "h-6 w-6"
            }`}
          >
            <SkipForward className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </span>
        )}

        {/* Compact cards show onboarding status as an icon badge (label via
                    title/aria-label); the roomy card renders a text chip in the body. */}
        {compact && (
          <span
            title={onboardingStatusLabel}
            aria-label={onboardingStatusLabel}
            className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-sm ${
              isOnboardingComplete
                ? "border-app-success-border bg-app-success-bg text-app-success-text"
                : "border-app-neutral-border bg-app-neutral-bg text-app-neutral-text"
            }`}
          >
            {isOnboardingComplete ? (
              <Check className="h-3 w-3" />
            ) : (
              <Hourglass className="h-2.5 w-2.5" />
            )}
          </span>
        )}
      </div>

      <div className={`flex items-center gap-2 ${compact ? "pr-7" : "gap-3 pr-14"}`}>
        {selectable && (
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? "border-app-brand bg-app-brand text-app-text-inverse"
                : "border-app-border bg-app-surface"
            }`}
          >
            {selected && <Check className="h-3 w-3" />}
          </span>
        )}

        <div className="flex shrink-0 items-center justify-center">
          <UserAvatar
            profileIcon={user.profileIcon}
            fallbackName={`${user.firstname} ${user.lastname}`.trim()}
            seed={user.userId}
            size={compact ? 26 : 40}
          />
        </div>

        <div className="min-w-0">
          <p className={`truncate font-semibold text-app-text ${compact ? "text-xs" : "text-sm"}`}>
            {user.firstname} {user.lastname}
          </p>
          {!compact && (
            <p className="text-sm text-app-text-muted">
              {user.roles.length > 0
                ? user.roles.map((role) => role.name).join(", ")
                : "No role assigned"}
            </p>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-3">
          <Badge
            variant={isOnboardingComplete ? "success" : "neutral"}
            className="gap-1.5 px-2.5 py-1"
          >
            {isOnboardingComplete ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Hourglass className="h-3 w-3" />
            )}
            {isOnboardingComplete ? "Onboarding completed" : "In progress"}
          </Badge>
        </div>
      )}

      <div className={compact ? "mt-2" : "mt-3"}>
        <div className="flex items-start justify-between gap-3">
          <p
            className={`line-clamp-2 font-medium text-app-text ${compact ? "text-xs" : "text-sm"}`}
          >
            {user.currentStep?.title ?? "No current step"}
          </p>

          <span
            className={`shrink-0 text-xs ${
              isAtRisk ? "font-medium text-app-warning-text" : "text-app-text-muted"
            }`}
          >
            {user.currentStep ? `${elapsedDays}d` : "—"}
          </span>
        </div>

        <div className={`flex items-center gap-2 ${compact ? "mt-2" : "mt-3"}`}>
          <div
            className={`flex-1 overflow-hidden rounded-full bg-app-progress-track ${
              compact ? "h-1" : "h-1.5"
            }`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <span
            className={`font-medium text-app-text tabular-nums ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {progressPercentage}%
          </span>
        </div>
      </div>
    </>
  );

  if (selectable) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${user.firstname} ${user.lastname}`}
        onClick={() => onToggleSelect?.(user.userId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleSelect?.(user.userId);
          }
        }}
        className={cardClassName}
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={`/team/${user.userId}`} className={cardClassName}>
      {content}
    </Link>
  );
}
