import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, CornerDownRight, Pencil } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { DragHandle } from "../../../../components/ui/DragHandle";
import { howStepGetsDone } from "../../howItsDone";
import type { ArrivalStep } from "../../types";

type StepRowProps = {
  step: ArrivalStep;
  readOnly: boolean;
  replaced: boolean;
  isOverride: boolean;
  projectName: string | null;
  draggable: boolean;
  /** True for the one row currently being picked up and moved. */
  isDragging: boolean;
  /** True for a moment right after this row's drop settles — plays a brief highlight. */
  justDropped: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onHandlePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
};

function cardClass(props: StepRowProps): string {
  const base = props.replaced
    ? "border-dashed border-app-border bg-app-surface-muted"
    : "border-app-border bg-app-surface";
  const dragging = props.isDragging ? "border-app-brand shadow-lg ring-2 ring-app-brand-glow" : "";
  const dropped = props.justDropped ? "border-app-brand ring-2 ring-app-brand-glow" : "";

  return `group/step relative flex-1 rounded-2xl border p-3 transition duration-500 ${base} ${dragging} ${dropped}`;
}

export function StepRow(props: StepRowProps) {
  const { step, readOnly, replaced } = props;

  return (
    <div className={cardClass(props)}>
      {/* Covers the whole card so clicking anywhere on it opens the edit drawer; the controls
          below sit in their own layer (pointer-events-auto) so they still catch their own clicks
          first. The handle below starts its own drag through `dragControls`, so it keeps working
          sitting in that same clickable layer above this overlay. */}
      {!readOnly && (
        <button
          type="button"
          onClick={props.onEdit}
          aria-label={`Edit "${step.title}"`}
          className="absolute inset-0 z-0 rounded-2xl"
        />
      )}

      <div className="pointer-events-none relative z-10 flex items-start gap-2">
        {props.draggable && (
          <span
            onPointerDown={props.onHandlePointerDown}
            className="pointer-events-auto touch-none select-none"
          >
            <DragHandle visibleClassName="group-hover/step:mr-1 group-hover/step:w-4 group-hover/step:opacity-100 group-hover/step:text-app-text-muted" />
          </span>
        )}

        <StepBody {...props} />

        {!readOnly && !replaced && <MoveButtons {...props} />}

        {!readOnly && (
          <span className="pointer-events-none flex h-9 w-9 shrink-0 items-center justify-center text-app-text-disabled opacity-0 transition-opacity group-hover/step:opacity-100">
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

function StepBody({ step, replaced, isOverride, projectName }: StepRowProps) {
  const howItsDone = howStepGetsDone(step);
  const HowItsDoneIcon = howItsDone.icon;

  return (
    <div className="min-w-0 flex-1">
      <p
        className={`text-sm ${replaced ? "text-app-text-subtle line-through" : "font-medium text-app-text"}`}
      >
        {step.title}
      </p>
      {step.description && <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {replaced && (
          <Badge
            variant="brand"
            size="md"
            title={`${projectName ?? "This project"} uses its own version of this step.`}
          >
            <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
            Overridden
          </Badge>
        )}
        {isOverride && (
          <Badge
            variant="brand"
            size="md"
            title="Replaces the company-wide wording for this project."
          >
            <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
            Override
          </Badge>
        )}
        <Badge
          variant={step.settledBy === "OBSERVED" ? "success" : "neutral"}
          size="md"
          title={howItsDone.label}
        >
          <HowItsDoneIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {howItsDone.badge}
        </Badge>
      </div>
    </div>
  );
}

function MoveButtons({ step, canMoveUp, canMoveDown, onMove }: StepRowProps) {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-1">
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
  );
}
