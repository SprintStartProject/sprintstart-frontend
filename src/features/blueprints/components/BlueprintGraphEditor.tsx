import { Link2, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { SidePanel } from "../../../components/ui/SidePanel.tsx";
import { Textarea } from "../../../components/ui/Textarea.tsx";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNodeProps,
} from "./BlueprintGraphCanvas.tsx";
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
  onPositionChange: (phase: BlueprintPhase, x: number, y: number) => Promise<void>;
  onRemoveNode: (phase: BlueprintPhase) => Promise<void>;
  onAddBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
  onRemoveBlocker: (phase: BlueprintPhase, blockerId: string) => Promise<void>;
  onCreateFromLibrary: (graphX: number, graphY: number) => Promise<void>;
  onDeletePhase: (phase: BlueprintPhase) => Promise<void>;
  onOpenSubGraph: (phase: BlueprintPhase) => void;
  onUpdatePhase: (phase: BlueprintPhase, metadata: BlueprintPhaseMetadata) => Promise<void>;
};

/** A phase-specific adapter around the reusable Blueprint graph canvas. */
export function BlueprintGraphEditor({
  phases,
  pathTitle,
  editable,
  onPositionChange,
  onRemoveNode,
  onAddBlocker,
  onRemoveBlocker,
  onCreateFromLibrary,
  onDeletePhase,
  onOpenSubGraph,
  onUpdatePhase,
}: Props) {
  const [detailsPhaseId, setDetailsPhaseId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsEditing, setIsDetailsEditing] = useState(false);
  const [isDetailsSaving, setIsDetailsSaving] = useState(false);
  const [detailsSaveError, setDetailsSaveError] = useState<string | null>(null);
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
    setIsDetailsEditing(false);
    setDetailsSaveError(null);
    setIsDetailsOpen(true);
  }

  async function deletePhase() {
    if (!detailsPhase) return;
    setIsDetailsOpen(false);
    setIsDetailsEditing(false);
    setDetailsPhaseId(null);
    await onDeletePhase(detailsPhase);
  }

  function beginPhaseEditing() {
    const phase = detailsPhaseId ? phaseById.get(detailsPhaseId) : null;
    if (!phase) return;
    setMetadata({
      title: phase.title,
      description: phase.description,
      type: phase.type,
      aiPrompt: phase.aiPrompt,
    });
    setDetailsSaveError(null);
    setIsDetailsEditing(true);
  }

  async function savePhaseMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phase = detailsPhaseId ? phaseById.get(detailsPhaseId) : null;
    if (!phase) return;
    setIsDetailsSaving(true);
    setDetailsSaveError(null);
    try {
      await onUpdatePhase(phase, {
        ...metadata,
        description: metadata.description || null,
        aiPrompt: metadata.type === "AI_ENHANCED" ? metadata.aiPrompt || null : null,
      });
      setIsDetailsEditing(false);
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
        libraryTitle="Phases"
        libraryDescription="Drag nodes onto the canvas. Drop a canvas node here to return it to the library."
        libraryEmptyMessage="All phases are on the canvas."
        libraryTemplates={[
          {
            id: "phase",
            title: "New phase",
            description: "Drop onto the canvas to create a phase.",
          },
        ]}
        editable={editable}
        onNodeClick={openPhaseDetails}
        onOpenNode={(phase) => {
          if (phase.type === "FIXED") onOpenSubGraph(phase);
        }}
        onPositionChange={onPositionChange}
        onRemoveNode={onRemoveNode}
        onAddBlocker={onAddBlocker}
        onRemoveBlocker={onRemoveBlocker}
        onCreateFromLibrary={(_templateId, graphX, graphY) => onCreateFromLibrary(graphX, graphY)}
        renderNode={(phase, graphNodeProps) => <GraphNodeCard phase={phase} {...graphNodeProps} />}
      />
      <SidePanel
        isOpen={isDetailsOpen && detailsPhaseId !== null}
        onClose={() => {
          setIsDetailsOpen(false);
          setIsDetailsEditing(false);
        }}
        title={detailsPhase?.title ?? "Phase details"}
        footer={
          editable && detailsPhase ? (
            isDetailsEditing ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deletePhase()}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setIsDetailsEditing(false)}
                  >
                    Cancel
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
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="dangerSoft"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => void deletePhase()}
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={beginPhaseEditing}>
                  Edit
                </Button>
              </div>
            )
          ) : undefined
        }
      >
        {detailsPhaseId && phaseById.get(detailsPhaseId) ? (
          <PhaseDetails
            phase={phaseById.get(detailsPhaseId)!}
            isEditing={isDetailsEditing}
            metadata={metadata}
            saveError={detailsSaveError}
            onMetadataChange={setMetadata}
            onSubmit={savePhaseMetadata}
          />
        ) : null}
      </SidePanel>
    </>
  );
}

function GraphNodeCard({
  phase,
  draggable,
  disabled,
  onDragStart,
  onClick,
  onOpen,
}: { phase: BlueprintPhase } & BlueprintGraphCanvasNodeProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  function clearLongPress() {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function openSubGraph() {
    if (!onOpen || disabled || phase.type !== "FIXED") return;
    suppressClickRef.current = true;
    onOpen();
  }

  return (
    <div
      data-graph-node
      draggable={draggable}
      onDragStart={(event) => {
        clearLongPress();
        onDragStart(event);
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onClick();
      }}
      onDoubleClick={openSubGraph}
      onPointerDown={(event) => {
        if (event.button !== 0 || !onOpen || disabled || phase.type !== "FIXED") return;
        longPressTimerRef.current = window.setTimeout(openSubGraph, 600);
      }}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={
        (draggable ? "cursor-grab " : "cursor-default ") +
        "min-h-20 rounded-xl border border-app-border bg-app-surface p-3 shadow-sm" +
        (disabled ? " pointer-events-none" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-app-text">{phase.title}</p>
        <Link2 className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="neutral">{phase.type}</Badge>
      </div>
    </div>
  );
}

function PhaseDetails({
  phase,
  isEditing,
  metadata,
  saveError,
  onMetadataChange,
  onSubmit,
}: {
  phase: BlueprintPhase;
  isEditing: boolean;
  metadata: BlueprintPhaseMetadata;
  saveError: string | null;
  onMetadataChange: React.Dispatch<React.SetStateAction<BlueprintPhaseMetadata>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (isEditing)
    return (
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
    );

  return (
    <div className="space-y-5 text-sm">
      <p className="text-app-text-muted">{phase.description || "No description yet."}</p>
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Type" value={phase.type} />
        <Detail label="Steps" value={String(phase.blueprintSteps.length)} />
        <Detail label="Knowledge checks" value={String(phase.blueprintCheckQuestions.length)} />
      </dl>
      <div>
        <h3 className="font-semibold text-app-text">AI prompt</h3>
        <p className="mt-1 text-app-text-muted">{phase.aiPrompt || "Not specified."}</p>
      </div>
      {phase.requirements?.length ? (
        <div>
          <h3 className="font-semibold text-app-text">Requirements</h3>
          <ul className="mt-2 space-y-2 text-app-text-muted">
            {phase.requirements.map((requirement) => (
              <li key={requirement.id}>{requirement.displayName}</li>
            ))}
          </ul>
        </div>
      ) : null}
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
