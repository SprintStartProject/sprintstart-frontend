import { useState } from "react";
import { Download, History, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/useToast";
import { offboardingService } from "../../../services/offboardingService";
import type { SnapshotSummary } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader } from "../../pm-area";
import { formatDay } from "../format";
import { useComparison, useSnapshots } from "../useSnapshots";
import { ComparisonView } from "./ComparisonView";

const MAX_COMPARED = 2;

function describe(snapshot: SnapshotSummary): string {
  return snapshot.label ?? `${snapshot.departing.join(", ")} · ${formatDay(snapshot.computedAt)}`;
}

function downloadJson(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function SnapshotRow({
  snapshot,
  picked,
  onToggle,
  onRemove,
}: {
  snapshot: SnapshotSummary;
  picked: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-app-border px-4 py-2.5 first:border-t-0">
      <Checkbox aria-label={`Compare ${describe(snapshot)}`} checked={picked} onChange={onToggle} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-app-text">{describe(snapshot)}</p>
        <p className="text-xs text-app-text-muted">
          {snapshot.orphaned} orphaned · {snapshot.hoarded} on one author · as of{" "}
          {formatDay(snapshot.asOf)}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Remove ${describe(snapshot)}`}
        onClick={onRemove}
        icon={<Trash2 className="h-4 w-4" />}
      />
    </li>
  );
}

/** Downloads every stored map pseudonymised, for the study. */
function ExportButton({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const exportAll = async () => {
    setExporting(true);
    try {
      downloadJson(
        "offboarding-study-export.json",
        await offboardingService.exportStudy(projectId),
      );
    } catch {
      toast.error("The export could not be created.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={exporting}
      disabled={disabled}
      onClick={() => void exportAll()}
      icon={<Download className="h-4 w-4" />}
    >
      Export for study
    </Button>
  );
}

/**
 * The stored risk maps of the project: pick two to compare how their rankings differ, remove one,
 * or download all of them pseudonymised for the study.
 */
export function SavedMapsPanel({ projectId }: { projectId: string }) {
  const toast = useToast();
  const snapshots = useSnapshots(projectId);
  const [picked, setPicked] = useState<string[]>([]);
  const both = picked.length === MAX_COMPARED;
  const comparison = useComparison(projectId, both ? picked[0] : null, both ? picked[1] : null);

  const toggle = (id: string) =>
    setPicked((now) =>
      now.includes(id) ? now.filter((other) => other !== id) : [...now, id].slice(-MAX_COMPARED),
    );

  const remove = async (id: string) => {
    try {
      await snapshots.remove(id);
      setPicked((now) => now.filter((other) => other !== id));
    } catch {
      toast.error("The risk map could not be removed.");
    }
  };

  const list = snapshots.data ?? [];
  return (
    <div className="space-y-4">
      <PmCard aria-label="Saved risk maps">
        <PmCardHeader
          icon={History}
          title="Saved risk maps"
          meta={`${list.length}`}
          action={<ExportButton projectId={projectId} disabled={list.length === 0} />}
        />
        {snapshots.error && (
          <EmptyState title="The saved maps could not be loaded" size="sm">
            Try again in a moment.
          </EmptyState>
        )}
        {!snapshots.error && list.length === 0 && !snapshots.loading && (
          <EmptyState title="Nothing saved yet" size="sm">
            Rank a departure and save the result to compare it with another later.
          </EmptyState>
        )}
        <ul className="-mx-4 -mb-4 border-t border-app-border">
          {list.map((snapshot) => (
            <SnapshotRow
              key={snapshot.id}
              snapshot={snapshot}
              picked={picked.includes(snapshot.id)}
              onToggle={() => toggle(snapshot.id)}
              onRemove={() => void remove(snapshot.id)}
            />
          ))}
        </ul>
      </PmCard>
      {comparison.data && <ComparisonView comparison={comparison.data} />}
    </div>
  );
}
