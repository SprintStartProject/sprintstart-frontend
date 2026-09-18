import { Check, CircleHelp, FilePlus2, Layers, ListChecks, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import { useToast } from "../../../context/useToast.ts";
import { BlueprintNodeCard } from "./BlueprintNodeCard.tsx";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNodeProps,
} from "./BlueprintGraphCanvas.tsx";
import { PhasePrerequisites } from "./PhasePrerequisites.tsx";
import type { BlueprintPhase, BlueprintPhaseType } from "../types.ts";

export type BlueprintPhaseMetadata = {
  title: string;
  description: string | null;
  type: BlueprintPhaseType;
  aiPrompt: string | null;
};

type Props = {
  phases: BlueprintPhase[];
  pathTitle: string;
  editable: boolean;
  /**
   * Asks the page to open a draft, on a version that cannot be edited.
   *
   * Without it a published blueprint drew a details panel with no footer at all, which reads
   * as "this has no actions" rather than "not on this version".
   *
   * Carries the phase it was asked from, so the page can put the author back in front of it once
   * the draft is open. Pressing "Edit as draft" inside a phase and landing on a graph with nothing
   * open is being answered with a different screen than the one the question was asked on.
   */
  onRequestDraft?: (phase: BlueprintPhase) => void;
  /**
   * A phase to open as soon as it is there, found by title.
   *
   * By title rather than by id because the two most common reasons to ask are a jump from the
   * outline and a landing on a freshly opened draft — and a draft is a *copy*, so every id in it
   * is new while the titles are the ones the author just read.
   */
  openPhaseTitle?: string | null;
  onOpenedPhase?: () => void;
  onPositionChange: (phase: BlueprintPhase, x: number, y: number) => Promise<void>;
  onAddBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
  onRemoveBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
  onCreateNode: (graphX: number, graphY: number) => Promise<void>;
  onDeletePhase: (phase: BlueprintPhase) => Promise<void>;
  onOpenSubGraph: (phase: BlueprintPhase) => void;
  onUpdatePhase: (phase: BlueprintPhase, metadata: BlueprintPhaseMetadata) => Promise<void>;
};

/** The phase as it is stored, which is what "changed" is measured against. */
function metadataOf(phase: BlueprintPhase): BlueprintPhaseMetadata {
  return {
    title: phase.title,
    description: phase.description,
    type: phase.type,
    aiPrompt: phase.aiPrompt,
  };
}

/** A phase-specific adapter around the reusable Blueprint graph canvas. */
export function BlueprintGraphEditor({
  phases,
  pathTitle,
  editable,
  onRequestDraft,
  onPositionChange,
  onAddBlocker,
  onRemoveBlocker,
  onCreateNode,
  onDeletePhase,
  onOpenSubGraph,
  onUpdatePhase,
  openPhaseTitle = null,
  onOpenedPhase,
}: Props) {
  const [detailsPhaseId, setDetailsPhaseId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsSaving, setIsDetailsSaving] = useState(false);
  const [detailsSaveError, setDetailsSaveError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const toast = useToast();
  const [metadata, setMetadata] = useState<BlueprintPhaseMetadata>({
    title: "",
    description: null,
    type: "FIXED",
    aiPrompt: null,
  });
  const phaseById = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);
  const detailsPhase = detailsPhaseId ? (phaseById.get(detailsPhaseId) ?? null) : null;

  function openPhaseDetails(phase: BlueprintPhase) {
    setDetailsPhaseId(phase.id);
    setMetadata(metadataOf(phase));
    setDetailsSaveError(null);
    setIsDetailsOpen(true);
  }

  // Asked for from somewhere else — the outline's "Open in graph", or a draft that was opened from
  // inside this very phase. Cleared through the callback, so it opens once rather than every time
  // the phases are reloaded.
  useEffect(() => {
    if (!openPhaseTitle) return;
    const match = phases.find((phase) => phase.title === openPhaseTitle);
    if (!match) return;
    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body,
    // and this is the pattern the repo already passes with.
    queueMicrotask(() => {
      setDetailsPhaseId(match.id);
      setMetadata(metadataOf(match));
      setDetailsSaveError(null);
      setIsDetailsOpen(true);
      onOpenedPhase?.();
    });
  }, [onOpenedPhase, openPhaseTitle, phases]);

  /**
   * Deletes the phase the details panel is showing, once somebody has said so twice.
   *
   * The panel is closed only after the request succeeds. Closing first — which is what this used to
   * do — told the author the phase was gone before anybody knew whether it was, and a failure then
   * had nowhere left to be shown.
   */
  async function deletePhase() {
    if (!detailsPhase) return;
    const { title } = detailsPhase;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeletePhase(detailsPhase);
      setIsDeleteConfirmOpen(false);
      setIsDetailsOpen(false);
      setDetailsPhaseId(null);
      toast.success(`Phase "${title}" deleted`);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "The phase could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  /** Whether anything in the panel differs from what is stored. */
  const isDirty =
    detailsPhase !== null && JSON.stringify(metadata) !== JSON.stringify(metadataOf(detailsPhase));

  async function savePhaseMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phase = detailsPhaseId ? phaseById.get(detailsPhaseId) : null;
    if (!phase) return;
    setIsDetailsSaving(true);
    setDetailsSaveError(null);
    try {
      const saved = {
        ...metadata,
        description: metadata.description || null,
        aiPrompt: metadata.type === "AI_ENHANCED" ? metadata.aiPrompt || null : null,
      };
      await onUpdatePhase(phase, saved);
      // Re-seeded from what was actually sent, so the panel reads as saved rather than still dirty
      // on a field the save normalised (an empty description becomes null on the way out).
      setMetadata(saved);
      toast.success("Phase saved");
    } catch (reason) {
      setDetailsSaveError(
        reason instanceof Error ? reason.message : "Phase metadata could not be saved.",
      );
    } finally {
      setIsDetailsSaving(false);
    }
  }

  return (
    <>
      <BlueprintGraphCanvas
        nodes={phases}
        title={pathTitle}
        description="Arrange the phases in this blueprint and connect their prerequisites."
        emptyTitle="No phases on the canvas yet"
        createKinds={[{ id: "phase", label: "New phase" }]}
        editable={editable}
        onNodeClick={openPhaseDetails}
        onOpenNode={(phase) => {
          if (phase.type === "FIXED") onOpenSubGraph(phase);
        }}
        onPositionChange={onPositionChange}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onCreateNode={(_kindId, graphX, graphY) => onCreateNode(graphX, graphY)}
        renderNode={(phase, graphNodeProps) => <GraphNodeCard phase={phase} {...graphNodeProps} />}
        openNodeId={isDetailsOpen ? detailsPhaseId : null}
        onCloseNodeDetail={() => {
          // Without the mode there is no Cancel, so stepping back out is the only way to walk away
          // from an edit — and it has to say so rather than dropping the work on the floor.
          if (isDirty) {
            setIsDiscardConfirmOpen(true);
            return;
          }
          setIsDetailsOpen(false);
        }}
        renderNodeDetail={(phase) => ({
          title: phase.title,
          body: (
            <PhaseDetails
              phase={phase}
              phases={phases}
              isEditing={editable}
              metadata={metadata}
              saveError={detailsSaveError}
              onMetadataChange={setMetadata}
              onSubmit={savePhaseMetadata}
              onAddBlocker={onAddBlocker}
              onRemoveBlocker={onRemoveBlocker}
            />
          ),
          footer: editable ? (
            /*
              No edit mode, and so nothing to cancel. The fields are simply live, and the footer
              says whether what is on screen has reached the server yet. The old arrangement made
              somebody press Edit to change a field and Cancel to stop — two decisions about a mode,
              on top of the one decision they actually had, which is what the phase should say.
            */
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="dangerSoft"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setDeleteError(null);
                  setIsDeleteConfirmOpen(true);
                }}
              >
                Delete
              </Button>
              {isDirty ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setMetadata(metadataOf(phase))}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    form="edit-blueprint-phase"
                    loading={isDetailsSaving}
                  >
                    Save changes
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-app-text-muted">
                  <Check className="h-4 w-4 text-app-success-solid" aria-hidden="true" />
                  Saved
                </p>
              )}
            </div>
          ) : onRequestDraft ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-app-text-muted">
                This version is published, so it is read-only.
              </p>
              <Button
                variant="primary"
                icon={<FilePlus2 className="h-4 w-4" />}
                onClick={() => onRequestDraft(phase)}
              >
                Edit as draft
              </Button>
            </div>
          ) : undefined,
        })}
      />
      <AlertDialog
        isOpen={isDeleteConfirmOpen}
        title={detailsPhase ? `Delete "${detailsPhase.title}"?` : "Delete this phase?"}
        description={
          <>
            <p>
              Its steps, knowledge checks and every prerequisite pointing at it go with it. Hires
              who already have a path built from this blueprint keep theirs — a personalized path is
              a copy, not a live reference.
            </p>
            <p className="mt-2">This cannot be undone from here.</p>
          </>
        }
        confirmLabel="Delete phase"
        variant="danger"
        isLoading={isDeleting}
        loadingLabel="Deleting…"
        errorMessage={deleteError ?? undefined}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => void deletePhase()}
      />
      <AlertDialog
        isOpen={isDiscardConfirmOpen}
        title="Discard your changes?"
        description={<p>This phase has edits that have not been saved.</p>}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="danger"
        onClose={() => setIsDiscardConfirmOpen(false)}
        onConfirm={() => {
          if (detailsPhase) setMetadata(metadataOf(detailsPhase));
          setIsDiscardConfirmOpen(false);
          setIsDetailsOpen(false);
        }}
      />
    </>
  );
}

function GraphNodeCard({
  phase,
  ...cardProps
}: { phase: BlueprintPhase } & BlueprintGraphCanvasNodeProps) {
  const isAiEnhanced = phase.type === "AI_ENHANCED";
  const stepCount = phase.blueprintSteps.length;
  const questionCount = phase.blueprintCheckQuestions.length;

  return (
    <BlueprintNodeCard
      {...cardProps}
      title={phase.title}
      kind={{
        label: isAiEnhanced ? "AI-enhanced" : "Phase",
        icon: isAiEnhanced ? Sparkles : Layers,
      }}
      // The one distinction between two phases that changes what they are: an AI-enhanced phase has
      // no content of its own until a path is generated from it. Worth a colour, where "this phase
      // has four steps and that one has six" is not.
      accent={isAiEnhanced ? "purple" : "brand"}
      metrics={
        isAiEnhanced
          ? undefined
          : [
              { icon: ListChecks, value: stepCount, label: stepCount === 1 ? "step" : "steps" },
              {
                icon: CircleHelp,
                value: questionCount,
                label: questionCount === 1 ? "check" : "checks",
              },
            ]
      }
      requirements={(phase.requirements ?? []).map((requirement) => ({
        label: requirement.displayName,
        type: requirement.type,
      }))}
      // Only a fixed phase has a sub-graph to open; an AI-enhanced one has no authored content
      // until a path is generated from it, so offering the drill-in would open an empty canvas.
      onOpen={isAiEnhanced ? undefined : cardProps.onOpen}
    />
  );
}

/**
 * Everything the panel says about one phase: its fields, and the things about it that are not
 * fields.
 *
 * The fields and the facts used to be two branches of an edit mode, so a draft showed the form and
 * nothing else — the step and check counts, and who the phase is for, were only visible on a
 * version you could not change. They are the context somebody needs *while* editing.
 */
function PhaseDetails({
  phase,
  phases,
  isEditing,
  metadata,
  saveError,
  onMetadataChange,
  onSubmit,
  onAddBlocker,
  onRemoveBlocker,
}: {
  phase: BlueprintPhase;
  isEditing: boolean;
  metadata: BlueprintPhaseMetadata;
  saveError: string | null;
  onMetadataChange: React.Dispatch<React.SetStateAction<BlueprintPhaseMetadata>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  phases: BlueprintPhase[];
  onAddBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
  onRemoveBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-6 text-sm">
      <PhasePrerequisites
        phase={phase}
        phases={phases}
        editable={isEditing}
        onAdd={onAddBlocker}
        onRemove={onRemoveBlocker}
      />
      {isEditing ? (
        <form
          id="edit-blueprint-phase"
          className="space-y-5"
          onSubmit={(event) => void onSubmit(event)}
        >
          <Field label="Title" required>
            <Input
              value={metadata.title}
              onChange={(event) =>
                onMetadataChange((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={metadata.description ?? ""}
              onChange={(event) =>
                onMetadataChange((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <Field label="Phase type">
            <Select
              value={metadata.type}
              onChange={(event) =>
                onMetadataChange((current) => ({
                  ...current,
                  type: event.target.value as BlueprintPhaseType,
                }))
              }
            >
              <option value="FIXED">Fixed</option>
              <option value="AI_ENHANCED">AI-enhanced</option>
            </Select>
          </Field>
          {metadata.type === "AI_ENHANCED" ? (
            <Field label="AI prompt">
              <Textarea
                value={metadata.aiPrompt ?? ""}
                onChange={(event) =>
                  onMetadataChange((current) => ({ ...current, aiPrompt: event.target.value }))
                }
              />
            </Field>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-sm text-app-danger-text">
              {saveError}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="space-y-5">
          <p className="text-app-text-muted">{phase.description || "No description yet."}</p>
          <div>
            <h3 className="font-semibold text-app-text">AI prompt</h3>
            <p className="mt-1 whitespace-pre-wrap text-app-text-muted">
              {phase.aiPrompt || "Not specified."}
            </p>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <Detail label="Type" value={phase.type === "AI_ENHANCED" ? "AI-enhanced" : "Fixed"} />
        <Detail label="Steps" value={String(phase.blueprintSteps.length)} />
        <Detail label="Checks" value={String(phase.blueprintCheckQuestions.length)} />
      </dl>

      <div>
        <h3 className="font-semibold text-app-text">Who this phase is for</h3>
        {phase.requirements?.length ? (
          <>
            <p className="mt-1 text-app-text-muted">
              Only members who meet all of these are given the phase.
            </p>
            <ul className="mt-2 space-y-2">
              {phase.requirements.map((requirement) => (
                <li key={requirement.id} className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm">
                    {requirement.type === "SKILL" ? "Skill" : "Project role"}
                  </Badge>
                  <span className="text-app-text">{requirement.displayName}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-app-text-muted">
            Everybody on the project. Requirements are added from the outline.
          </p>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-app-surface-muted p-3">
      <dt className="text-xs text-app-text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-app-text">{value}</dd>
    </div>
  );
}

/**
 * What this phase waits on, as a list that can be added to and taken from.
 *
 * The canvas could draw a prerequisite and nothing else could. That made the one relation in this
 * model reachable by dragging and by no other means — no keyboard, no way to check what a phase
 * waits on without finding it on the canvas and following the arrows out of it by eye, and no way
 * at all on a touch screen. An arrow is a fact about a phase, so it belongs on the phase.
 *
 * The same refusals as the canvas, from the same function: a phase cannot wait for itself, cannot
 * wait twice for the same thing, and cannot join a ring. Refused options are not offered rather
 * than offered and rejected — a menu that lists what it will not accept is a menu that lies.
 */
