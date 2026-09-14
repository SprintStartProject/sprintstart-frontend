import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import type {
  IndustryConfidence,
  ProjectIndustryEvaluation,
} from "../../../services/projectService";
import { IndustryConfidenceBadge } from "./IndustryConfidenceBadge";
import { useProjectIndustryEvaluation } from "./useProjectIndustryEvaluation";

type ProjectIndustryPanelProps = {
  projectId: string;
  industry: string;
  industryConfidence: IndustryConfidence | null;
  /** Whether the viewer may trigger a re-evaluation. Hides the button entirely when false. */
  canEvaluate: boolean;
  disabled?: boolean;
  onEvaluated: (evaluation: ProjectIndustryEvaluation) => void;
};

/**
 * Shows a project's detected industry and, for authorized viewers, a button to
 * re-run the AI evaluation.
 *
 * The manual trigger always overwrites whatever industry is currently set, so a
 * non-empty value is confirmed before the call goes out.
 */
export function ProjectIndustryPanel({
  projectId,
  industry,
  industryConfidence,
  canEvaluate,
  disabled = false,
  onEvaluated,
}: ProjectIndustryPanelProps) {
  const toast = useToast();
  const { isEvaluating, lastEvaluation, evaluate } = useProjectIndustryEvaluation(projectId);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const runEvaluation = async () => {
    const result = await evaluate();

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    if (result.evaluation.industry) {
      toast.success(`Industry set to "${result.evaluation.industry}"`);
    } else {
      toast.info("No industry could be detected from the ingested sources");
    }

    onEvaluated(result.evaluation);
  };

  const handleEvaluateClick = () => {
    if (industry.trim()) {
      setIsConfirmOpen(true);
      return;
    }

    void runEvaluation();
  };

  const confirmEvaluate = () => {
    setIsConfirmOpen(false);
    void runEvaluation();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-app-text" data-testid="project-industry-value">
          {industry || "Not determined yet"}
        </p>
        <IndustryConfidenceBadge confidence={industryConfidence} size="sm" />
      </div>

      {lastEvaluation && lastEvaluation.evidence.length > 0 && (
        <ul className="space-y-1.5 text-sm text-app-text-muted">
          {lastEvaluation.evidence.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {canEvaluate && (
        <Button
          variant="secondary"
          size="sm"
          loading={isEvaluating}
          disabled={disabled}
          icon={<Sparkles className="h-4 w-4" />}
          onClick={handleEvaluateClick}
          data-testid="reevaluate-industry-button"
        >
          Re-evaluate industry
        </Button>
      )}

      <AlertDialog
        isOpen={isConfirmOpen}
        title="Re-evaluate industry?"
        description={`This overwrites the current industry ("${industry}") with a fresh AI evaluation.`}
        confirmLabel="Re-evaluate"
        cancelLabel="Cancel"
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmEvaluate}
      />
    </div>
  );
}
