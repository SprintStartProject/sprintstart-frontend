import { Plus } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { StagedSourceList } from "../../StagedSourceList";
import type { DraftSource } from "../../../projectSourcesDraft";

type WizardSourcesStepProps = {
  sources: DraftSource[];
  disabled?: boolean;
  onRemove: (sourceId: string) => void;
  onAddSource: () => void;
};

/**
 * Step 3 of the create-project wizard: the editable list of staged sources plus
 * the entry point into the add-source sub-flow. Nothing here is connected yet —
 * the whole list is committed together on the provisioning screen after the
 * project is created.
 */
export function WizardSourcesStep({
  sources,
  disabled = false,
  onRemove,
  onAddSource,
}: WizardSourcesStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-app-text">Data sources</p>
        <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
          Everything here is ingested right after you create the project. Optional — you can add
          sources later from the Data Ingestion page too.
        </p>
      </div>

      <StagedSourceList
        sources={sources}
        disabled={disabled}
        onRemove={onRemove}
        emptyMessage="No sources yet. Add a GitHub repository — you can mix in more source types later."
      />

      <Button
        variant="secondary"
        onClick={onAddSource}
        disabled={disabled}
        icon={<Plus className="h-4 w-4" />}
        className="w-full"
      >
        Add source
      </Button>
    </div>
  );
}
