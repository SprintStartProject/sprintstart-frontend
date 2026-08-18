import { Users } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { getTeamOverview } from "../../../services/teamManagementService";
import type { TeamOverviewUser } from "../../team-management/types";
import { useProjectContext } from "../../projects/useProjectContext";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

/**
 * How the selected project's team is doing, as three figures.
 *
 * Reads the same overview the PM dashboard's team card does, so a manager glancing at the
 * dashboard and one opening team management are never told different things.
 *
 * "Waiting on you" counts the two things a member cannot resolve alone — a skip request
 * nobody has answered, and feedback nobody has read. Those are the reason to open the page,
 * so they are the reason this card exists.
 */
function summarize(members: readonly TeamOverviewUser[]): WidgetMetric[] {
  const stillOnboarding = members.filter((member) => member.progressPercentage < 100).length;

  const waitingOnYou = members.filter(
    (member) => member.currentStep?.skip?.status === "PENDING" || member.hasFeedback,
  ).length;

  const averageProgress =
    members.length > 0
      ? Math.round(
          members.reduce((total, member) => total + member.progressPercentage, 0) / members.length,
        )
      : 0;

  return [
    {
      label: "Team members",
      value: members.length,
      hint: stillOnboarding === 1 ? "1 still onboarding" : `${stillOnboarding} still onboarding`,
    },
    {
      label: "Average progress",
      value: averageProgress,
      suffix: "%",
      hint: "of their onboarding done",
    },
    {
      label: "Waiting on you",
      value: waitingOnYou,
      needsAttention: waitingOnYou > 0,
      hint: waitingOnYou > 0 ? "skip requests or unread feedback" : "nothing needs answering",
    },
  ];
}

export function TeamOverviewWidget() {
  const { selectedProjectId } = useProjectContext();

  const { data, loading, error } = useFetch(
    () =>
      getTeamOverview(undefined, undefined, selectedProjectId ? [selectedProjectId] : undefined),
    [selectedProjectId],
  );

  return (
    <WidgetShell
      icon={Users}
      title="Team overview"
      actionLabel="Open team management"
      to="/team-management"
      isLoading={loading}
      errorMessage={error || !data ? "Could not load the team overview." : null}
    >
      <WidgetMetrics icon={Users} metrics={summarize(data ?? [])} />
    </WidgetShell>
  );
}
