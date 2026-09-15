import { useId, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
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
  /** Whether the industry was set by hand (PM/admin) rather than by the AI evaluation. */
  industryCustom: boolean;
  /** Whether the viewer may trigger a re-evaluation. Hides the button entirely when false. */
  canEvaluate: boolean;
  disabled?: boolean;
  /**
   * Hides the evidence list behind a "Show evidence" toggle instead of always
   * showing it. Collapsed by default. Used on the PM Dashboard, where the
   * widget sits in a compact card; the admin drawer has room to show it
   * outright.
   */
  collapsibleEvidence?: boolean;
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
  industryCustom,
  canEvaluate,
  disabled = false,
  collapsibleEvidence = false,
  onEvaluated,
}: ProjectIndustryPanelProps) {
  const toast = useToast();
  const { isEvaluating, lastEvaluation, evaluate } = useProjectIndustryEvaluation(projectId);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const evidenceListId = useId();

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-app-text" data-testid="project-industry-value">
            {industry || "Not determined yet"}
          </p>
          <IndustryConfidenceBadge confidence={industryConfidence} isCustom={industryCustom} />
        </div>

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
      </div>

      {lastEvaluation && lastEvaluation.evidence.length > 0 && (
        <>
          {collapsibleEvidence && (
            <button
              type="button"
              onClick={() => setIsEvidenceExpanded((current) => !current)}
              aria-expanded={isEvidenceExpanded}
              aria-controls={evidenceListId}
              className="flex items-center gap-1.5 text-sm font-medium text-app-text-muted hover:text-app-text"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isEvidenceExpanded ? "rotate-180" : ""
                }`}
              />
              {isEvidenceExpanded
                ? "Hide evidence"
                : `Show evidence (${lastEvaluation.evidence.length})`}
            </button>
          )}

          {(!collapsibleEvidence || isEvidenceExpanded) && (
            <ul id={evidenceListId} className="space-y-1.5 text-sm text-app-text-muted">
              {lastEvaluation.evidence.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AlertDialog
        isOpen={isConfirmOpen}
        title="Re-evaluate industry?"
        description={
          industryCustom
            ? `This overwrites the manually set industry ("${industry}") with a fresh AI evaluation.`
            : `This overwrites the current industry ("${industry}") with a fresh AI evaluation.`
        }
        confirmLabel="Re-evaluate"
        cancelLabel="Cancel"
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmEvaluate}
      />
    </div>
  );
}
