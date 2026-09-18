import { useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, CornerDownRight, Eye, Pencil } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DragHandle } from "../../../components/ui/DragHandle";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { ArrivalScope, ArrivalStep } from "../types";

const EMPTY_SET = new Set<string>();

type StepEntry = {
  step: ArrivalStep;
  scope: ArrivalScope;
  /** A company step a project override shadows: kept in place, but off the count. */
  replaced: boolean;
  /** A project step that reuses a company step's key. */
  isOverride: boolean;
  /** Null for a replaced step — it never had a place of its own to count. */
  number: number | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

type ThreadNode =
  | { kind: "label"; id: string; text: string; muted: boolean }
  | { kind: "step"; id: string; entry: StepEntry };

/**
 * Both arrival lists as the one thread a new hire actually walks down, rather than two separately
 * counted blocks: the company-wide steps first, then — when a project is in context — what that
 * project adds, numbered straight through in the order the hire sees them.
 *
 * A company step a project override shadows keeps its place in the company section (so the
 * relationship between the two still reads clearly) but carries no number of its own, just a small
 * dot on the thread — the project's own version, further down, is what counts.
 *
 * Reordering stays inside one section: the backend sorts each scope separately, so a drag or an
 * up/down press against a company step only ever touches the company order, and the same for a
 * project step.
 */
export function ArrivalStepThread({
  companySteps,
  projectSteps,
  hasProject,
  projectName,
  readOnly,
  onMove,
  onReorder,
  onEdit,
}: {
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  hasProject: boolean;
  projectName: string | null;
  readOnly: boolean;
  onMove: (key: string, direction: "up" | "down", scope: ArrivalScope) => void;
  onReorder: (orderedKeys: string[], scope: ArrivalScope) => void;
  onEdit: (step: ArrivalStep, scope: ArrivalScope) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [draggedScope, setDraggedScope] = useState<ArrivalScope | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  if (companySteps.length === 0 && projectSteps.length === 0) {
    return <EmptyState size="sm">No steps here yet.</EmptyState>;
  }

  const companyKeys = new Set(companySteps.map((step) => step.key));
  const overriddenKeys = hasProject ? new Set(projectSteps.map((step) => step.key)) : EMPTY_SET;

  let running = 0;
  const companyEntries: StepEntry[] = companySteps.map((step, index) => {
    const replaced = overriddenKeys.has(step.key);
    return {
      step,
      scope: "company",
      replaced,
      isOverride: false,
      number: replaced ? null : ++running,
      canMoveUp: !replaced && index > 0,
      canMoveDown: !replaced && index < companySteps.length - 1,
    };
  });
  const projectEntries: StepEntry[] = hasProject
    ? projectSteps.map((step, index) => ({
        step,
        scope: "project" as const,
        replaced: false,
        isOverride: companyKeys.has(step.key),
        number: ++running,
        canMoveUp: index > 0,
        canMoveDown: index < projectSteps.length - 1,
      }))
    : [];

  const projectDisplayName = projectName ?? "this project";
  const nodes: ThreadNode[] = [];
  if (hasProject) {
    nodes.push({ kind: "label", id: "mark-company", text: "For everyone", muted: false });
  }
  for (const entry of companyEntries) {
    nodes.push({ kind: "step", id: `company:${entry.step.key}`, entry });
  }
  if (hasProject) {
    if (projectEntries.length > 0) {
      nodes.push({
        kind: "label",
        id: "mark-project",
        text: `Only in ${projectDisplayName}`,
        muted: false,
      });
      for (const entry of projectEntries) {
        nodes.push({ kind: "step", id: `project:${entry.step.key}`, entry });
      }
    } else {
      nodes.push({
        kind: "label",
        id: "mark-project-empty",
        text: `Nothing extra for ${projectDisplayName} yet`,
        muted: true,
      });
    }
  }

  const sectionSteps = (scope: ArrivalScope) => (scope === "company" ? companySteps : projectSteps);

  return (
    <ol className="list-none">
      {nodes.map((node, position) => {
        const isLast = position === nodes.length - 1;
        const draggable = node.kind === "step" && !readOnly && !node.entry.replaced;

        return (
          <li
            key={node.id}
            draggable={draggable}
            onDragStart={(event: DragEvent<HTMLLIElement>) => {
              if (node.kind !== "step" || !draggable) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", node.entry.step.key);
              setDraggedKey(node.entry.step.key);
              setDraggedScope(node.entry.scope);
            }}
            onDragEnd={() => {
              setDraggedKey(null);
              setDraggedScope(null);
              setDragOverKey(null);
            }}
            onDragOver={(event: DragEvent<HTMLLIElement>) => {
              if (node.kind !== "step") return;
              if (
                !draggedKey ||
                draggedScope !== node.entry.scope ||
                draggedKey === node.entry.step.key
              ) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverKey(node.entry.step.key);
            }}
            onDragLeave={(event: DragEvent<HTMLLIElement>) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              if (node.kind === "step") {
                setDragOverKey((current) => (current === node.entry.step.key ? null : current));
              }
            }}
            onDrop={(event: DragEvent<HTMLLIElement>) => {
              event.preventDefault();
              if (node.kind !== "step") return;
              const scope = node.entry.scope;
              const targetKey = node.entry.step.key;
              const activeKey = draggedKey;
              const activeScope = draggedScope;
              setDraggedKey(null);
              setDraggedScope(null);
              setDragOverKey(null);
              if (!activeKey || activeScope !== scope || activeKey === targetKey) return;
              const steps = sectionSteps(scope);
              const from = steps.findIndex((candidate) => candidate.key === activeKey);
              const to = steps.findIndex((candidate) => candidate.key === targetKey);
              if (from === -1 || to === -1) return;
              const reordered = [...steps];
              const [moved] = reordered.splice(from, 1);
              reordered.splice(to, 0, moved);
              onReorder(
                reordered.map((candidate) => candidate.key),
                scope,
              );
            }}
            className={`relative ${isLast ? "" : "pb-3"}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {node.kind === "step" && node.entry.number !== null ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-app-brand bg-app-surface text-sm font-bold text-app-brand-text">
                    {node.entry.number}
                  </span>
                ) : (
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-app-border" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-1.5">
                {node.kind === "label" ? (
                  <p
                    className={
                      node.muted
                        ? "text-xs text-app-text-subtle"
                        : "text-xs font-semibold tracking-wide text-app-text-subtle uppercase"
                    }
                  >
                    {node.text}
                  </p>
                ) : (
                  <StepRow
                    step={node.entry.step}
                    readOnly={readOnly}
                    replaced={node.entry.replaced}
                    isOverride={node.entry.isOverride}
                    projectName={projectName}
                    draggable={draggable}
                    isDragTarget={
                      dragOverKey === node.entry.step.key && draggedKey !== node.entry.step.key
                    }
                    canMoveUp={node.entry.canMoveUp}
                    canMoveDown={node.entry.canMoveDown}
                    onMove={(direction) => onMove(node.entry.step.key, direction, node.entry.scope)}
                    onEdit={() => onEdit(node.entry.step, node.entry.scope)}
                  />
                )}
              </div>
            </div>

            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-0 left-4 -ml-px w-0.5 bg-app-border"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepRow({
  step,
  readOnly,
  replaced,
  isOverride,
  projectName,
  draggable,
  isDragTarget,
  canMoveUp,
  canMoveDown,
  onMove,
  onEdit,
}: {
  step: ArrivalStep;
  readOnly: boolean;
  replaced: boolean;
  isOverride: boolean;
  projectName: string | null;
  draggable: boolean;
  isDragTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`group/step flex flex-1 items-start gap-2 rounded-2xl border p-3 transition-colors ${
        replaced
          ? "border-dashed border-app-border bg-app-surface-muted"
          : "border-app-border bg-app-surface"
      } ${isDragTarget ? "border-app-brand ring-2 ring-app-brand-glow" : ""}`}
    >
      {draggable && (
        <DragHandle visibleClassName="group-hover/step:mr-1 group-hover/step:w-4 group-hover/step:opacity-100 group-hover/step:text-app-text-muted" />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${replaced ? "text-app-text-subtle line-through" : "font-medium text-app-text"}`}
        >
          {step.title}
        </p>
        {step.description && <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {replaced && (
            <Badge variant="brand" size="sm">
              <CornerDownRight className="h-3 w-3" aria-hidden="true" />
              Replaced for {projectName ?? "this project"}
            </Badge>
          )}
          {isOverride && (
            <Badge variant="brand" size="sm">
              <CornerDownRight className="h-3 w-3" aria-hidden="true" />
              Replaces the company wording
            </Badge>
          )}
          {step.settledBy === "OBSERVED" && (
            <Badge variant="success" size="sm">
              <Eye className="h-3 w-3" aria-hidden="true" />
              We check this
            </Badge>
          )}
          {step.settledBy === "OBSERVED" && !step.selfConfirmable && (
            <Badge variant="neutral" size="sm">
              Hire can&apos;t tick it
            </Badge>
          )}
        </div>
      </div>

      {!readOnly && !replaced && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => onMove("up")}
            disabled={!canMoveUp}
            aria-label={`Move "${step.title}" earlier`}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => onMove("down")}
            disabled={!canMoveDown}
            aria-label={`Move "${step.title}" later`}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label={`Edit "${step.title}"`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
