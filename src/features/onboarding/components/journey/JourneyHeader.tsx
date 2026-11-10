import { AlertTriangle, GitBranch, ListChecks, Rocket } from "lucide-react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Badge } from "../../../../components/ui/Badge";
import { SegmentedTabs } from "../../../../components/ui/SegmentedTabs";
import { issueStatusLabel } from "../../generationIssues";
import { ProgressRing } from "../../graph/JourneyNodeCards";
import type { OnboardingGenerationIssueEndpoint } from "../../../../services/onboardingTypes";
import type { ViewMode } from "../../hooks/useJourneyView";

/** How many phases could not be generated, beside the title. */
function IssueBadge({ issues }: { issues: OnboardingGenerationIssueEndpoint[] }) {
  const summary = issues
    .map((issue) => `${issue.title} — ${issueStatusLabel(issue.status)}`)
    .join("\n");
  return (
    <span
      role="status"
      aria-label={`${issues.length} onboarding ${issues.length === 1 ? "phase" : "phases"} could not be generated`}
    >
      <Badge variant="warning" size="sm" title={summary}>
        <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {issues.length}
      </Badge>
    </span>
  );
}

/**
 * The page title. Rebuilding a path throws the member's progress away, so it is the PM's call: it
 * lives on the member's page in the PM area, not here.
 */
export function JourneyHeader({
  isFinished,
  issues,
}: {
  isFinished: boolean;
  issues: OnboardingGenerationIssueEndpoint[];
}) {
  return (
    <header className="border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={Rocket}
          title="Onboarding"
          subtitle={
            isFinished
              ? "You made it through every phase. Everything stays here to look back on."
              : "Your path into the project. Phases that are open can be done in any order."
          }
          actions={issues.length > 0 ? <IssueBadge issues={issues} /> : undefined}
        />
      </div>
    </header>
  );
}

export type OverallProgress = {
  percentage: number;
  phasesDone: number;
  stepsDone: number;
};

function ProgressSummary({
  overall,
  phaseCount,
}: {
  overall: OverallProgress;
  phaseCount: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing value={overall.percentage} size={44} stroke={4.5}>
        <span className="text-2xs font-bold text-app-text tabular-nums">{overall.percentage}%</span>
      </ProgressRing>
      <div className="text-sm leading-tight">
        <p className="font-semibold text-app-text tabular-nums">
          {overall.phasesDone} of {phaseCount} phases complete
        </p>
        <p className="text-xs text-app-text-muted tabular-nums">
          {overall.stepsDone} {overall.stepsDone === 1 ? "step" : "steps"} done
          {overall.phasesDone > 0 ? " — keep it up" : ""}
        </p>
      </div>
    </div>
  );
}

type ToolbarProps = {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  overall: OverallProgress | null;
  phaseCount: number;
};

/** The graph/list switch and how far along the hire is overall. */
export function ViewToolbar({ viewMode, onChange, overall, phaseCount }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <SegmentedTabs
        layoutId="onboarding-view-mode"
        ariaLabel="Onboarding view"
        value={viewMode}
        onChange={onChange}
        options={[
          { value: "graph", label: "Graph", icon: <GitBranch className="h-4 w-4" /> },
          { value: "list", label: "List", icon: <ListChecks className="h-4 w-4" /> },
        ]}
      />
      {overall ? <ProgressSummary overall={overall} phaseCount={phaseCount} /> : null}
    </div>
  );
}
