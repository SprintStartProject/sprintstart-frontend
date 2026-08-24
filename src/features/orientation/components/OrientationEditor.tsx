import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, PencilLine, Plus, Save, Undo2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { useToast } from "../../../context/useToast";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { STEP_LABELS, STEP_ORDER } from "../steps";
import { useOrientationDraft, type DraftStep } from "../hooks/useOrientationDraft";
import type { AuthorOrientationInput, OrientationPacket, OrientationStep } from "../types";

type OrientationEditorProps = {
  /** The task the orientation belongs to; its title heads the editor. */
  taskTitle: string;
  /** The task's link (e.g. the GitHub issue). Shown as an "Open issue" action when present. */
  taskUrl: string | null;
  /** The packet being edited, or null to author from blank. */
  initial: OrientationPacket | null;
  onSave: (input: AuthorOrientationInput) => Promise<boolean>;
  /** Hands the task back to AI assembly. Omitted when there is no packet to revert. */
  onRevert?: () => Promise<boolean>;
  onClose: () => void;
};

const inputClasses =
  "w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus";

/**
 * The editor a PM or a hire uses to write a task's orientation by hand.
 *
 * The five steps of the path to a pull request are fixed and always shown: each is its own section,
 * an expandable card the author opens to write, or leaves blank to skip. There is no reordering and
 * no step picker — the order is the process. Chromed like the app's other detail drawers so authoring
 * sits in the same visual language as reading. Citations are optional throughout.
 */
export function OrientationEditor({
  taskTitle,
  taskUrl,
  initial,
  onSave,
  onRevert,
  onClose,
}: OrientationEditorProps) {
  const draft = useOrientationDraft(initial);
  const toast = useToast();
  const [busy, setBusy] = useState<"saving" | "reverting" | null>(null);
  // Single-open accordion. Start on the first written step, or the first step when authoring blank,
  // so the editor never opens onto five collapsed rows with no obvious place to begin.
  const [openStep, setOpenStep] = useState<OrientationStep | null>(
    () => (draft.steps.find(draft.isFilled) ?? draft.steps[0]).step,
  );

  const handleSave = async () => {
    if (!draft.isValid || busy) return;
    setBusy("saving");
    try {
      const ok = await onSave(draft.toInput());
      if (ok) {
        toast.success("Orientation saved");
        onClose();
      } else {
        toast.error("Save failed", { description: "Please try again." });
      }
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleRevert = async () => {
    if (!onRevert || busy) return;
    setBusy("reverting");
    try {
      const ok = await onRevert();
      if (ok) {
        toast.success("Handed back to AI");
        onClose();
      } else {
        toast.error("AI handoff failed", { description: "Please try again." });
      }
    } catch (err) {
      toast.error("AI handoff failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  // Portaled to <body> so the fixed panel clears any transformed ancestor (the sliding tab panel)
  // that would otherwise contain it. The extra AnimatePresence resets the `initial={false}` that a
  // surrounding SlidingTabPanel's AnimatePresence pushes down the tree and across the portal —
  // without it the panel inherits "no enter animation" and pops in instead of sliding.
  return createPortal(
    <AnimatePresence>
      <DetailsSideDrawer
        isOpen
        onClose={onClose}
        title="Write this orientation yourself"
        closeAriaLabel="Close orientation editor"
        showOverlay
        actions={
          taskUrl ? (
            <a
              href={taskUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open issue
            </a>
          ) : undefined
        }
        leading={
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand-text">
            <PencilLine className="h-5 w-5" aria-hidden="true" />
          </span>
        }
        badge={<span className="text-sm text-app-text-muted">For &ldquo;{taskTitle}&rdquo;</span>}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-app-text-subtle tabular-nums">
              {draft.filledCount} of {STEP_ORDER.length} steps written
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              {onRevert && (
                <Button
                  variant="secondary"
                  data-testid="revert-orientation"
                  onClick={() => void handleRevert()}
                  disabled={busy !== null}
                  loading={busy === "reverting"}
                  icon={<Undo2 className="h-4 w-4" />}
                >
                  Hand back to AI
                </Button>
              )}
              <Button
                variant="primary"
                data-testid="save-orientation"
                onClick={() => void handleSave()}
                disabled={!draft.isValid || busy !== null}
                loading={busy === "saving"}
                icon={<Save className="h-4 w-4" />}
              >
                Save orientation
              </Button>
            </div>
          </div>
        }
      >
        <div data-testid="orientation-editor" className="space-y-4 sm:space-y-5">
          <DrawerCard label="Summary" icon={PencilLine} index={0}>
            <input
              id="orientation-summary"
              aria-label="One-line summary"
              value={draft.summary}
              onChange={(event) => draft.setSummary(event.target.value)}
              placeholder="What this task is, in a sentence."
              className={inputClasses}
            />
          </DrawerCard>

          {draft.steps.map((step, index) => (
            <StepRow
              key={step.step}
              index={index + 1}
              step={step}
              filled={draft.isFilled(step)}
              partial={draft.isPartial(step)}
              isOpen={openStep === step.step}
              onToggle={() => setOpenStep((current) => (current === step.step ? null : step.step))}
              onTitleChange={(value) => draft.setStepTitle(step.step, value)}
              onBodyChange={(value) => draft.setStepBody(step.step, value)}
              onAddCitation={() => draft.addCitation(step.step)}
              onUpdateCitation={(citationKey, patch) =>
                draft.updateCitation(step.step, citationKey, patch)
              }
              onRemoveCitation={(citationKey) => draft.removeCitation(step.step, citationKey)}
            />
          ))}
        </div>
      </DetailsSideDrawer>
    </AnimatePresence>,
    document.body,
  );
}

type StepRowProps = {
  index: number;
  step: DraftStep;
  filled: boolean;
  partial: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onAddCitation: () => void;
  onUpdateCitation: (citationKey: string, patch: { filename?: string; sourceUrl?: string }) => void;
  onRemoveCitation: (citationKey: string) => void;
};

/**
 * One step, as its own section: a quiet header (number, step name, current title) that expands into
 * the only fields that matter — a title, the guidance, and optional sources. Status lives in the
 * number badge's colour, so nothing else has to shout.
 */
function StepRow({
  index,
  step,
  filled,
  partial,
  isOpen,
  onToggle,
  onTitleChange,
  onBodyChange,
  onAddCitation,
  onUpdateCitation,
  onRemoveCitation,
}: StepRowProps) {
  const label = STEP_LABELS[step.step];

  const badgeTone = filled
    ? "bg-app-brand-soft text-app-brand-text"
    : partial
      ? "bg-app-warning-bg text-app-warning-text"
      : "border border-app-border text-app-text-subtle";

  return (
    <DrawerCard bare index={index}>
      <div
        data-testid="editor-section"
        className="overflow-hidden rounded-2xl border border-app-border bg-app-surface"
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${badgeTone}`}
          >
            {index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
              {label}
            </span>
            <span
              className={`mt-0.5 block truncate text-sm ${
                step.title ? "font-medium text-app-text" : "text-app-text-subtle"
              }`}
            >
              {step.title || "Not written yet"}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div className="space-y-4 border-t border-app-border px-4 py-4">
            <div>
              <label
                htmlFor={`step-title-${step.step}`}
                className="mb-1.5 block text-xs font-medium text-app-text"
              >
                Title
              </label>
              <input
                id={`step-title-${step.step}`}
                data-testid={`step-title-${step.step}`}
                value={step.title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="A short heading for this step"
                className={inputClasses}
              />
            </div>

            <div>
              <label
                htmlFor={`step-body-${step.step}`}
                className="mb-1.5 block text-xs font-medium text-app-text"
              >
                Details
              </label>
              <textarea
                id={`step-body-${step.step}`}
                data-testid={`step-body-${step.step}`}
                rows={4}
                value={step.body}
                onChange={(event) => onBodyChange(event.target.value)}
                placeholder="What a hire does here. Markdown is fine."
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              {step.citations.map((citation) => (
                <div key={citation.key} className="flex items-center gap-1.5">
                  <input
                    aria-label="Source name"
                    value={citation.filename}
                    onChange={(event) =>
                      onUpdateCitation(citation.key, { filename: event.target.value })
                    }
                    placeholder="Source (e.g. README.md)"
                    className="w-1/3 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  />
                  <input
                    aria-label="Source link"
                    value={citation.sourceUrl}
                    onChange={(event) =>
                      onUpdateCitation(citation.key, { sourceUrl: event.target.value })
                    }
                    placeholder="https://… (optional)"
                    className="flex-1 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Remove source"
                    onClick={() => onRemoveCitation(citation.key)}
                    className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={onAddCitation}
                className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <Plus className="h-3 w-3" />
                Add a source
              </button>
            </div>

            {partial && (
              <p className="text-xs text-app-warning-text">
                Add both a title and details, or clear both to skip this step.
              </p>
            )}
          </div>
        )}
      </div>
    </DrawerCard>
  );
}
