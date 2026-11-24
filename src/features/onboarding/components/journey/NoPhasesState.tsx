import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { retryCouldHelp } from "../../generationIssues";
import type { OnboardingGenerationIssueEndpoint } from "../../../../services/onboardingTypes";
import { GenerationIssueSummary } from "../GenerationIssueSummary";
import { CenteredState, StateIcon } from "./CenteredState";

type Issues = OnboardingGenerationIssueEndpoint[];

function Explanation({ issues }: { issues: Issues }) {
  const generated = issues.length > 0;
  return (
    <>
      <h2 className="mt-5 text-xl font-semibold text-app-text">
        {generated ? "No onboarding phases were generated" : "No onboarding phases are available"}
      </h2>
      <p className="mt-2 mb-5 max-w-lg text-sm text-app-text-muted">
        {generated
          ? "Every phase in this blueprint is written by the AI service when your path is built, and none of them could be. Nothing has been left half-finished — the journey is simply empty until one of them lands."
          : "This onboarding path does not contain any phases for your current role and skills."}
      </p>
    </>
  );
}

/**
 * Why the phases failed, when they did. Retrying a phase that was skipped for lack of material
 * changes nothing, so when that is all there is, the manager is told so rather than invited to get
 * the same answer.
 */
function IssueDetail({ issues, canManage }: { issues: Issues; canManage: boolean }) {
  if (issues.length === 0) return null;
  return (
    <div className="w-full max-w-lg">
      <GenerationIssueSummary issues={issues} />
      {canManage && (
        <p className="mt-5 text-xs text-app-text-subtle">
          {retryCouldHelp(issues)
            ? "Trying again re-runs assembly for every phase."
            : "Another run will produce the same result until the project has more material."}
        </p>
      )}
    </div>
  );
}

type RetryProps = {
  issues: Issues;
  canManage: boolean;
  hasProject: boolean;
  onStart: () => void;
};

/**
 * Building an existing path again replaces it, which is the project manager's call: the backend
 * refuses it to members, so they are pointed at the PM instead of a button that can only fail.
 */
function Retry({ issues, canManage, hasProject, onStart }: RetryProps) {
  if (!canManage) {
    return (
      <p className="mt-6 max-w-lg text-sm text-app-text-muted">
        Your project manager can rebuild your path from your page in the team area.
      </p>
    );
  }
  return (
    <Button
      className="mt-6"
      variant={issues.length === 0 || retryCouldHelp(issues) ? "primary" : "secondary"}
      onClick={onStart}
      icon={<RefreshCw className="h-4 w-4" />}
      disabled={!hasProject}
    >
      Try generation again
    </Button>
  );
}

type Props = RetryProps & {
  /**
   * The conversation as a way out. Generating again is the wrong hope when the corpus is what was
   * thin -- it comes back empty a second time -- so it is offered beside the retry (or the pointer to
   * the PM) rather than instead of it. Handed in, because the buddy is another feature's.
   */
  buddy: ReactNode;
};

/** A path with no phase to show: none were generated, or none fit the hire's role and skills. */
export function NoPhasesState({ issues, canManage, hasProject, onStart, buddy }: Props) {
  return (
    <CenteredState>
      <StateIcon tone="warning">
        <AlertTriangle className="h-7 w-7" />
      </StateIcon>
      <Explanation issues={issues} />
      <IssueDetail issues={issues} canManage={canManage} />
      <Retry issues={issues} canManage={canManage} hasProject={hasProject} onStart={onStart} />
      {issues.length > 0 ? buddy : null}
    </CenteredState>
  );
}
