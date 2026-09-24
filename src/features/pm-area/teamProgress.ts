import type { TeamOverviewUser } from "../team-management/types";
import type { ChartDatum } from "./components/charts/chartTypes";
import { memberStage, progressPercent } from "./memberStatus";

/** Colours of the three stages, used by the overview's team chart. */
export const STAGE_COLOR = {
  "not-started": "text-app-border-strong",
  underway: "text-app-brand",
  done: "text-app-success-solid",
} as const;

/** The team's onboarding stages and its average progress, from the roster alone. */
export function teamProgressData(members: TeamOverviewUser[]) {
  const stages: ChartDatum[] = (["not-started", "underway", "done"] as const).map((stage) => ({
    key: stage,
    label: stage === "not-started" ? "Not started" : stage === "underway" ? "Underway" : "Done",
    value: members.filter((member) => memberStage(member) === stage).length,
    colorClassName: STAGE_COLOR[stage],
  }));

  const averageProgress =
    members.length === 0
      ? 0
      : Math.round(
          members.reduce((sum, member) => sum + progressPercent(member), 0) / members.length,
        );

  return { stages, averageProgress };
}
