import { MessageSquareText, SkipForward, Users } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { getTeamOverview } from "../../../services/teamManagementService";
import { useProjectContext } from "../../projects/useProjectContext";
import type { TeamOverviewUser } from "../../team-management/types";
import type { DashboardWidgetSize } from "../layout/types";
import { WidgetBar } from "./WidgetBar";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

const NAMED_WAITING_COUNT = 3;

type WaitingMember = {
  member: TeamOverviewUser;
  reason: string;
  /** A skip request blocks the member; unread feedback only waits on the manager. */
  isBlocking: boolean;
};

type TeamSummary = {
  memberCount: number;
  notStarted: number;
  inProgress: number;
  finished: number;
  waiting: WaitingMember[];
};

function fullName(member: TeamOverviewUser): string {
  return `${member.firstname} ${member.lastname}`.trim() || "Unnamed member";
}

/**
 * Splits the team into the three states a manager acts on differently.
 *
 * Replaces the average progress this card used to lead with. An average across a team is
 * true and useless: 50% reads the same whether everybody is halfway or half the team has
 * not started, and those two call for opposite responses.
 *
 * "Waiting on you" is the two things a member cannot resolve alone — a skip request nobody
 * has answered, and feedback nobody has read. A skip outranks feedback when both apply,
 * because it is the one with somebody stuck behind it.
 */
function summarize(members: readonly TeamOverviewUser[]): TeamSummary {
  const waiting = members.flatMap<WaitingMember>((member) => {
    if (member.currentStep?.skip?.status === "PENDING") {
      return [{ member, reason: "asked to skip a step", isBlocking: true }];
    }

    return member.hasFeedback
      ? [{ member, reason: "left feedback to read", isBlocking: false }]
      : [];
  });

  return {
    memberCount: members.length,
    notStarted: members.filter((member) => member.progressPercentage <= 0).length,
    inProgress: members.filter(
      (member) => member.progressPercentage > 0 && member.progressPercentage < 100,
    ).length,
    finished: members.filter((member) => member.progressPercentage >= 100).length,
    waiting,
  };
}

function metricsFor(summary: TeamSummary): WidgetMetric[] {
  return [
    {
      label: "Team members",
      value: summary.memberCount,
      hint: `${summary.finished} through their onboarding`,
    },
    {
      label: "Not started yet",
      value: summary.notStarted,
      needsAttention: summary.notStarted > 0,
      hint: summary.notStarted > 0 ? "have not opened their path" : "everybody has begun",
    },
    {
      label: "Waiting on you",
      value: summary.waiting.length,
      needsAttention: summary.waiting.length > 0,
      hint: summary.waiting.length > 0 ? "skip requests or feedback" : "nothing needs answering",
    },
  ];
}

/**
 * How the selected project's team is doing.
 *
 * Reads the same overview the PM dashboard's team card does, so a manager glancing at the
 * dashboard and one opening team management are never told different things.
 *
 * At half a row the card adds what the figures cannot say: how the team is spread across the
 * onboarding, and *who* is waiting. A count of two people needing an answer is a reminder;
 * two names is a task.
 */
export function TeamOverviewWidget({ size }: { size: DashboardWidgetSize }) {
  const { selectedProjectId } = useProjectContext();

  const { data, loading, error } = useFetch(
    () =>
      getTeamOverview(undefined, undefined, selectedProjectId ? [selectedProjectId] : undefined),
    [selectedProjectId],
  );

  const summary = summarize(data ?? []);
  const namedWaiting = summary.waiting.slice(0, NAMED_WAITING_COUNT);
  const hiddenWaiting = summary.waiting.length - namedWaiting.length;

  return (
    <WidgetShell
      icon={Users}
      title="Team overview"
      actionLabel="Open team management"
      to="/team-management"
      isLoading={loading}
      errorMessage={error || !data ? "Could not load the team overview." : null}
    >
      {size === "small" ? (
        <WidgetMetrics icon={Users} metrics={metricsFor(summary)} />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
          <WidgetMetrics icon={Users} metrics={metricsFor(summary).slice(0, 2)} />

          <div className="flex flex-col justify-center gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Onboarding
              </p>
              <WidgetBar
                segments={[
                  { label: "done", value: summary.finished, className: "bg-app-success-solid" },
                  { label: "underway", value: summary.inProgress, className: "bg-app-brand" },
                  { label: "not started", value: summary.notStarted, className: "bg-app-border" },
                ]}
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Waiting on you
              </p>

              {namedWaiting.length === 0 ? (
                <p className="text-xs text-app-text-muted">Nothing needs answering.</p>
              ) : (
                <ul className="space-y-1">
                  {namedWaiting.map(({ member, reason, isBlocking }) => (
                    <li
                      key={member.userId}
                      className="flex items-center gap-1.5 text-xs text-app-text-muted"
                    >
                      {isBlocking ? (
                        <SkipForward aria-hidden="true" className="h-3 w-3 shrink-0" />
                      ) : (
                        <MessageSquareText aria-hidden="true" className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate font-medium text-app-text">{fullName(member)}</span>
                      <span className="truncate">{reason}</span>
                    </li>
                  ))}

                  {hiddenWaiting > 0 && (
                    <li className="text-xs text-app-text-muted">and {hiddenWaiting} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
