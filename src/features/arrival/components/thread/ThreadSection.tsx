import type { ArrivalScope, ArrivalStep } from "../../types";
import { ThreadRow } from "./ThreadRow";
import { rowId } from "./threadRules";
import type { StepEntry } from "./threadRules";

export function ThreadSectionLabel({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <p
      className={
        muted
          ? "text-xs text-app-text-subtle"
          : "text-xs font-semibold tracking-wide text-app-text-subtle uppercase"
      }
    >
      {text}
    </p>
  );
}

type ThreadSectionProps = {
  entries: StepEntry[];
  scope: ArrivalScope;
  readOnly: boolean;
  projectName: string | null;
  draggingRowId: string | null;
  justDroppedRowId: string | null;
  prefersReducedMotion: boolean;
  registerRow: (id: string, element: HTMLElement | null) => void;
  onDragStartRow: (key: string) => void;
  onDragRow: (key: string) => void;
  onDragEndRow: (key: string) => void;
  onMove: (key: string, direction: "up" | "down") => void;
  onEdit: (step: ArrivalStep) => void;
};

/**
 * One section's rows, plus the single line that threads through them.
 *
 * The line is one static element spanning the section top to bottom, not a segment stitched onto
 * each row and not measured against where any one card's number happens to sit — a reorder only
 * ever moves the numbers and cards across it, and the line itself never moves or resizes along
 * with them.
 */
export function ThreadSection(props: ThreadSectionProps) {
  const { entries, scope } = props;

  return (
    <ol className="relative flex list-none flex-col gap-3">
      {entries.length > 1 && <ThreadLine />}
      {entries.map((entry) => (
        <ThreadRow
          key={entry.step.key}
          entry={entry}
          readOnly={props.readOnly}
          projectName={props.projectName}
          isDraggingThis={props.draggingRowId === rowId(scope, entry.step.key)}
          justDropped={props.justDroppedRowId === rowId(scope, entry.step.key)}
          prefersReducedMotion={props.prefersReducedMotion}
          registerElement={(element) => props.registerRow(rowId(scope, entry.step.key), element)}
          onDragStart={() => props.onDragStartRow(entry.step.key)}
          onDrag={() => props.onDragRow(entry.step.key)}
          onDragEnd={() => props.onDragEndRow(entry.step.key)}
          onMove={(direction) => props.onMove(entry.step.key, direction)}
          onEdit={() => props.onEdit(entry.step)}
        />
      ))}
    </ol>
  );
}

function ThreadLine() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-4 z-0 -ml-px w-0.5 bg-app-border"
      />
      {/* A thin line just stops; a small cap at each end says the thread has a start and an
          end there, rather than being cut off mid-flow. */}
      <span
        aria-hidden="true"
        className="absolute top-2 left-4 z-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-border"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-4 z-0 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-app-border"
      />
    </>
  );
}
