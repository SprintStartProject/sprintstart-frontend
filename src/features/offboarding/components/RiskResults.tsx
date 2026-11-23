import { AlertTriangle, FileWarning, Files, UserMinus } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import type { RiskMap } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader, PmStat } from "../../pm-area";
import { RiskFileRow } from "./RiskFileRow";

function UnknownPeopleNotice({ people }: { people: string[] }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        No recorded change belongs to {people.join(", ")}. Check the spelling, or link the
        identities they commit under.
      </p>
    </div>
  );
}

function SummaryStats({ map }: { map: RiskMap }) {
  const { summary } = map;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <PmStat
        icon={UserMinus}
        label="Nobody left"
        value={summary.orphaned}
        hint="files lose their last author"
        attention={summary.orphaned > 0}
      />
      <PmStat
        icon={FileWarning}
        label="One person left"
        value={summary.hoarded}
        hint="files rely on a single author"
        tone="warning"
      />
      <PmStat
        icon={Files}
        label="Files in history"
        value={summary.files}
        hint={`${summary.alreadyOrphaned} had no active author before`}
        tone="neutral"
      />
    </div>
  );
}

/** The ranking of a departure: how much is at risk, then every file at risk, most urgent first. */
export function RiskResults({ map }: { map: RiskMap }) {
  const hiddenFiles = map.summary.orphaned + map.summary.hoarded - map.files.length;
  return (
    <div className="space-y-4">
      {map.unknownDeparting.length > 0 && <UnknownPeopleNotice people={map.unknownDeparting} />}
      <SummaryStats map={map} />
      <PmCard aria-label="Files at risk">
        <PmCardHeader
          icon={FileWarning}
          title="Files at risk"
          meta={`most urgent first · ${map.settings.name} settings`}
        />
        {map.files.length === 0 ? (
          <EmptyState size="sm">
            Nothing is left without its authors when these people leave.
          </EmptyState>
        ) : (
          <ul className="-mx-4 -mb-4 border-t border-app-border">
            {map.files.map((file) => (
              <RiskFileRow key={`${file.repository}:${file.path}`} file={file} />
            ))}
          </ul>
        )}
        {hiddenFiles > 0 && (
          <p className="mt-4 text-xs text-app-text-muted">
            {hiddenFiles} more files at risk are not listed.
          </p>
        )}
      </PmCard>
    </div>
  );
}
