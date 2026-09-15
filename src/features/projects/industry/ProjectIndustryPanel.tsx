import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, Pencil, Sparkles, X } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
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
  /**
   * Whether the viewer may manually set the industry. Hides the edit button
   * entirely when false or when `onSave` is not given.
   */
  canEdit?: boolean;
  /**
   * Persists a manually entered industry. A resolved promise exits edit mode;
   * a rejected one leaves the field open (with the entered value kept) so the
   * caller's own error toast is not paired with a UI that looks untouched.
   */
  onSave?: (industry: string) => Promise<void>;
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
  canEdit = false,
  onSave,
}: ProjectIndustryPanelProps) {
  const toast = useToast();
  const { isEvaluating, lastEvaluation, evaluate } = useProjectIndustryEvaluation(projectId);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const evidenceListId = useId();
  const showEditButton = canEdit && Boolean(onSave);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

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

  const startEditing = () => {
    setEditValue(industry);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const trimmedEditValue = editValue.trim();
  const canSaveEdit = trimmedEditValue.length > 0 && trimmedEditValue !== industry.trim();

  const saveIndustry = async () => {
    if (!onSave || !canSaveEdit || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmedEditValue);
      setIsEditing(false);
      setEditValue("");
    } catch {
      // The caller already surfaced the error as a toast; keep the field open
      // (with the typed value) so the user can retry without retyping it.
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveIndustry();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {isEditing ? (
            <Input
              ref={editInputRef}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={handleEditKeyDown}
              placeholder="e.g. Fintech / Banking"
              disabled={isSaving}
              aria-label="Industry"
              className="min-w-0 flex-1"
              data-testid="industry-edit-input"
            />
          ) : (
            <>
              <p className="text-sm font-medium text-app-text" data-testid="project-industry-value">
                {industry || "Not determined yet"}
              </p>
              <IndustryConfidenceBadge confidence={industryConfidence} isCustom={industryCustom} />
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="primary"
                onClick={() => void saveIndustry()}
                disabled={!canSaveEdit}
                loading={isSaving}
                icon={<Check className="h-4 w-4" aria-hidden="true" />}
                data-testid="save-industry-button"
              >
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={cancelEditing}
                disabled={isSaving}
                icon={<X className="h-4 w-4" aria-hidden="true" />}
                data-testid="cancel-industry-button"
              >
                Cancel
              </Button>
            </>
          ) : (
            showEditButton && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={startEditing}
                disabled={disabled || isEvaluating}
                aria-label="Edit industry"
                data-testid="edit-industry-button"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            )
          )}

          {canEvaluate && (
            <Button
              variant="secondary"
              size="sm"
              loading={isEvaluating}
              disabled={disabled || isEditing}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleEvaluateClick}
              data-testid="reevaluate-industry-button"
            >
              Re-evaluate industry
            </Button>
          )}
        </div>
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
