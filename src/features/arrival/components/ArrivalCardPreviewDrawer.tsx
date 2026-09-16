import { useMemo, useState } from "react";
import { PlaneLanding } from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs";
import { Spinner } from "../../../components/ui/Spinner";
import { ArrivalStepList } from "./ArrivalStepList";
import { useArrivalAuthoring } from "../hooks/useArrivalAuthoring";
import { summarise } from "../summarise";
import type { ArrivalStep } from "../types";

type PreviewStage = "first-day" | "few-days";

const STAGE_OPTIONS = [
  { value: "first-day" as const, label: "First day" },
  { value: "few-days" as const, label: "A few days in" },
];

/**
 * Shows how the board card "Getting you set up" ({@link ArrivalStepsCard}) will look to a hire on
 * this list, without needing an actual hire whose real progress it could read.
 *
 * Reads the lists itself (`useArrivalAuthoring`) rather than taking them as props, so it stays a
 * self-contained add-on `ArrivalSection` can mount only while open — the pattern the "Pick from
 * issues" sheet on Starter work already uses, and here it also means this second read never
 * happens until somebody actually asks to preview.
 *
 * Two examples rather than one: a merged list read alone cannot show what a settled step even
 * looks like, and "everything outstanding" hides exactly the states — a checked step, a ticked
 * one — that authoring is trying to get right. Both are made up here for display only; nothing
 * about a real hire is read or written.
 */
export function ArrivalCardPreviewDrawer({
  isOpen,
  onClose,
  projectId,
  projectName,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string | null;
}) {
  const { company, project, loading } = useArrivalAuthoring(projectId);
  const [stage, setStage] = useState<PreviewStage>("first-day");

  // What a hire on this project actually sees: the company list with anything the project has
  // overridden left out — the override stands in its place — followed by what the project adds.
  // Same rule `groupByScope` and the backend's own merge both keep.
  const merged = useMemo(() => {
    const companySteps = company ?? [];
    const projectSteps = project ?? [];
    const overriddenKeys = new Set(projectSteps.map((step) => step.key));
    return [...companySteps.filter((step) => !overriddenKeys.has(step.key)), ...projectSteps];
  }, [company, project]);

  const previewSteps = useMemo(() => exampleSteps(merged, stage), [merged, stage]);

  const outstanding = previewSteps.filter((step) => !step.settled).length;
  const observed = previewSteps.filter((step) => step.rigor === "OBSERVED").length;
  const declared = previewSteps.filter((step) => step.rigor === "DECLARED").length;

  return (
    <DetailsSideDrawer
      isOpen={isOpen}
      onClose={onClose}
      showOverlay
      title="Preview: Getting you set up"
      leading={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand-text">
          <PlaneLanding className="h-5 w-5" aria-hidden="true" />
        </span>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="Loading the arrival lists" />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          <p className="text-sm text-app-text-muted">
            What a hire{projectName ? <> on {projectName}</> : null} sees on their board, made up
            for two example moments — nobody&apos;s real progress is shown here.
          </p>

          <SegmentedTabs
            value={stage}
            onChange={setStage}
            options={STAGE_OPTIONS}
            layoutId="arrival-preview-stage-pill"
            ariaLabel="Which example moment to show"
          />

          <p className="text-sm font-medium text-app-text">
            {summarise({ observed, declared, outstanding })}
          </p>

          {previewSteps.length === 0 ? (
            <EmptyState size="sm">No steps to show yet — add one first.</EmptyState>
          ) : (
            <ArrivalStepList steps={previewSteps} />
          )}
        </div>
      )}
    </DetailsSideDrawer>
  );
}

/**
 * Makes up a settled state for the merged list, purely for display.
 *
 * "First day" is every step outstanding, the true state of a hire who joined an hour ago. "A few
 * days in" settles every step a system check could plausibly have already seen (`OBSERVED`) plus
 * roughly the first half of what is left to the hire's own word — a few days of ticking things off
 * at their own pace, not everything at once. Not a simulation of any real hire; just something to
 * point a screenshot at.
 */
function exampleSteps(steps: ArrivalStep[], stage: PreviewStage): ArrivalStep[] {
  if (stage === "first-day") {
    return steps.map((step) => ({ ...step, settled: false, settledAt: null, rigor: null }));
  }

  const selfPaced = steps.filter((step) => step.settledBy !== "OBSERVED");
  const doneSoFar = new Set(
    selfPaced.slice(0, Math.ceil(selfPaced.length / 2)).map((step) => step.key),
  );

  return steps.map((step) => {
    const settled = step.settledBy === "OBSERVED" || doneSoFar.has(step.key);
    return {
      ...step,
      settled,
      settledAt: settled ? new Date().toISOString() : null,
      rigor: settled ? step.settledBy : null,
    };
  });
}
