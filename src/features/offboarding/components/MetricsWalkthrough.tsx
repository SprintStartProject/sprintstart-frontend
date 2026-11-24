import { useState } from "react";
import { Ruler } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
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

function Step({ step, number }: { step: MetricStep; number: number }) {
  return (
    <li className="border-t border-app-border px-4 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-app-brand-soft text-xs font-semibold text-app-brand">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-app-text">{step.name}</h3>
        <Badge variant="neutral" size="sm">
          {step.id}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-app-text">{step.asks}</p>
      <p className="mt-1 text-sm text-app-text-muted">{step.how}</p>
      <div className="mt-2 rounded-lg bg-app-brand-soft px-3 py-2 text-sm text-app-text">
        <span className="font-medium">On this file: </span>
        {step.measured}
        {step.value !== null && <Bar value={step.value} />}
      </div>
      <p className="mt-1 text-xs text-app-text-muted">Source: {step.source}</p>
    </li>
  );
}

/**
 * Goes through every metric of the ranking, one after the other, and shows what each measured on a
 * file of the ranking on screen: the question, how it is calculated, and the numbers it came to.
 */
export function MetricsWalkthrough({ map }: { map: RiskMap | undefined }) {
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
      <Field label="Example file" hint="The most urgent files of the ranking on screen.">
        <Select value={chosen} onChange={(event) => setChosen(Number(event.target.value))}>
          {files.map((candidate, index) => (
            <option key={`${candidate.repository}:${candidate.path}`} value={index}>
              {candidate.path}
            </option>
          ))}
        </Select>
      </Field>
      <PmCard aria-label="Metrics">
        <PmCardHeader
          icon={Ruler}
          title="How each metric measures this file"
          meta={`${steps.length}`}
        />
        <ol className="-mx-4 -mb-4 border-t border-app-border">
          {steps.map((step, index) => (
            <Step key={step.id + step.name} step={step} number={index + 1} />
          ))}
        </ol>
      </PmCard>
    </div>
  );
}
