import { useState } from "react";
import { Ruler } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Select } from "../../../components/ui/Select";
import { HintedField } from "./HintedField";
import type { RiskMap } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader } from "../../pm-area";
import { describeMetrics, type MetricStep } from "../metricGuide";

const LISTED_FILES = 40;

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-app-surface-muted" aria-hidden>
      <div
        className="h-full rounded-full bg-app-brand"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

function explanation(step: MetricStep): string {
  return `${step.asks} ${step.how} Why: ${step.why} Source: ${step.source}.`;
}

function Step({ step }: { step: MetricStep }) {
  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-app-border px-4 py-3.5 first:border-t-0">
      <div className="flex w-64 shrink-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-brand-soft text-xs font-semibold text-app-brand">
          {step.number ?? "Σ"}
        </span>
        <h3 className="text-sm font-semibold text-app-text">{step.name}</h3>
        <InfoHint text={explanation(step)} label={`About ${step.name}`} />
      </div>
      <div className="min-w-0 flex-1 text-sm text-app-text">
        {step.measured}
        {step.value !== null && <Bar value={step.value} />}
      </div>
    </li>
  );
}

/**
 * Goes through every metric of the ranking, one after the other, and shows what each measured on a
 * file of the ranking on screen: the question, how it is calculated, and the numbers it came to.
 */
export function MetricsWalkthrough({ map }: { map: RiskMap | null | undefined }) {
  const [chosen, setChosen] = useState(0);
  if (!map || map.files.length === 0) {
    return (
      <EmptyState title="Rank a departure first" size="sm">
        The metrics are shown on a file of a ranking. Rank a departure in the Ranking view and come
        back.
      </EmptyState>
    );
  }
  const files = map.files.slice(0, LISTED_FILES);
  const file = files[Math.min(chosen, files.length - 1)];
  const steps = describeMetrics(file, map);
  return (
    <div className="space-y-4">
      <HintedField label="Example file" hint="The most urgent files of the ranking on screen.">
        <Select value={chosen} onChange={(event) => setChosen(Number(event.target.value))}>
          {files.map((candidate, index) => (
            <option key={`${candidate.repository}:${candidate.path}`} value={index}>
              {candidate.path}
            </option>
          ))}
        </Select>
      </HintedField>
      <PmCard aria-label="Metrics">
        <PmCardHeader
          icon={Ruler}
          title="How each metric measures this file"
          meta={`${steps.length}`}
        />
        <ol className="-mx-4 -mb-4 border-t border-app-border">
          {steps.map((step) => (
            <Step key={step.id + step.name} step={step} />
          ))}
        </ol>
      </PmCard>
    </div>
  );
}
