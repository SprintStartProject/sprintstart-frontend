import type { TeamOverviewUser } from "../team-management/types";
import type { ChartDatum } from "./components/charts/chartTypes";
import {
  AT_RISK_AFTER_DAYS,
  daysOnStep,
  memberName,
  memberStage,
  progressPercent,
} from "./memberStatus";

/** Colours of the three stages, used by the overview's team chart. */
export const STAGE_COLOR = {
  "not-started": "text-app-border-strong",
  underway: "text-app-brand",
  done: "text-app-success-solid",
} as const;

type StepBin = { key: string; label: string; min: number; max: number };

/** Time on the current step, in bins that end where a member starts counting as at risk. */
const STEP_BINS: readonly StepBin[] = [
  { key: "today", label: "Today", min: 0, max: 0 },
  { key: "1-2", label: "1–2 d", min: 1, max: 2 },
  { key: "3-5", label: `3–${AT_RISK_AFTER_DAYS} d`, min: 3, max: AT_RISK_AFTER_DAYS },
  { key: "6-10", label: `${AT_RISK_AFTER_DAYS + 1}–10 d`, min: AT_RISK_AFTER_DAYS + 1, max: 10 },
  { key: "10+", label: "10+ d", min: 11, max: Number.POSITIVE_INFINITY },
];

function namesHint(members: TeamOverviewUser[]): string | undefined {
  if (members.length === 0) return undefined;
  const names = members.slice(0, 3).map(memberName).join(", ");
  return members.length > 3 ? `${names} +${members.length - 3}` : names;
}

/** The team's stages and the spread of time on the current step, from the roster alone. */
export function teamProgressData(members: TeamOverviewUser[]) {
  const stages: ChartDatum[] = (["not-started", "underway", "done"] as const).map((stage) => ({
    key: stage,
    label: stage === "not-started" ? "Not started" : stage === "underway" ? "Underway" : "Done",
    value: members.filter((member) => memberStage(member) === stage).length,
    colorClassName: STAGE_COLOR[stage],
  }));

  const underway = members
    .map((member) => ({ member, days: daysOnStep(member) }))
    .filter(
      (entry): entry is { member: TeamOverviewUser; days: number } =>
        memberStage(entry.member) === "underway" && entry.days !== null,
    );

  const stepBins: ChartDatum[] = STEP_BINS.map((bin) => {
    const inBin = underway
      .filter((entry) => entry.days >= bin.min && entry.days <= bin.max)
      .sort((a, b) => b.days - a.days)
      .map((entry) => entry.member);

    return {
      key: bin.key,
      label: bin.label,
      value: inBin.length,
      colorClassName: bin.min > AT_RISK_AFTER_DAYS ? "text-app-warning-solid" : "text-app-brand",
      hint: namesHint(inBin),
    };
  });

  const averageProgress =
    members.length === 0
      ? 0
      : Math.round(
          members.reduce((sum, member) => sum + progressPercent(member), 0) / members.length,
        );

  return {
    stages,
    stepBins,
    averageProgress,
    atRisk: underway.filter((entry) => entry.days > AT_RISK_AFTER_DAYS).length,
  };
}
