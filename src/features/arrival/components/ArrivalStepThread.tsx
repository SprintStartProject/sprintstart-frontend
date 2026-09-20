import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, CornerDownRight, Pencil } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DragHandle } from "../../../components/ui/DragHandle";
import { EmptyState } from "../../../components/ui/EmptyState";
import { moveTo } from "../../board/layout/boardOrder";
import { howStepGetsDone } from "../howItsDone";
import type { ArrivalScope, ArrivalStep } from "../types";

const EMPTY_SET = new Set<string>();

/** Spring used for a row settling into its reordered slot. */
const LAYOUT_TRANSITION = { type: "spring", stiffness: 500, damping: 40, mass: 0.6 } as const;

/** Below this, two rows swapping on every pointer-move frame would fight each other — the same
 * fix the board grid uses for the same kind of edge-docking jitter. */
const MOVE_COOLDOWN_MS = 160;

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

function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/** Re-reads a list in a given key order; falls back to the original if the two disagree, which
 * only happens for a moment while a fresh load is still in flight. */
function reorderByKeys(steps: ArrivalStep[], keys: string[]): ArrivalStep[] {
  if (keys.length !== steps.length) return steps;
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const reordered = keys.map((key) => byKey.get(key));
  return reordered.every((step): step is ArrivalStep => step !== undefined) ? reordered : steps;
}

/** A company step and the project step that overrides it share one key, so the key alone does not
 * identify a row — everything that addresses a single row goes through the scoped id instead. */
function rowId(scope: ArrivalScope, key: string): string {
  return `${scope}:${key}`;
}

function centerOf(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function contains(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Both arrival lists as the one thread a new hire actually walks down, rather than two separately
 * counted blocks: the company-wide steps first, then — when a project is in context — what that
 * project adds, numbered straight through in the order the hire sees them.
 *
 * A company step a project override shadows keeps its place in the company section (so the
 * relationship between the two still reads clearly) but carries no number of its own, just a small
 * dot on the thread — the project's own version, further down, is what counts.
 *
 * Reordering stays inside one section: the backend sorts each scope separately, so a drag against a
 * company step only ever touches the company order, and the same for a project step. A row is
 * picked up and moved by hand — no ghost image trailing the pointer, the card itself is what moves —
 * and the rest of its section slides out of the way live as it crosses them, the same way the board
 * grid re-sorts cards. The numbers stay put until the pointer is actually released; only then does
 * the new order get written down.
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
  const prefersReducedMotion = useReducedMotion();

  const [companyOrder, setCompanyOrder] = useState<string[]>(() =>
    companySteps.map((step) => step.key),
  );
  const [projectOrder, setProjectOrder] = useState<string[]>(() =>
    projectSteps.map((step) => step.key),
  );
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [draggingScope, setDraggingScope] = useState<ArrivalScope | null>(null);
  // Briefly rings the row that a drop just settled, cleared on its own after the pulse plays.
  const [justDroppedRowId, setJustDroppedRowId] = useState<string | null>(null);

  // Measured on mount/render via each row's ref, read back during a drag to work out which row the
  // one in hand is currently over. Keyed by scoped row id, not by step key.
  const rowElements = useRef(new Map<string, HTMLElement>());
  const lastMoveAt = useRef(0);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read inside the effects below rather than put in their dependency arrays: a drag ending flips
  // `draggingScope` back to null a beat before the silent reload it triggered actually lands, and
  // `companySteps`/`projectSteps` are still the pre-drop order at that instant. Depending on
  // `draggingScope` directly would re-run the sync right then, snapping the row that just settled
  // back to its old spot and then forward again once the fresh order arrives — the exact
  // already-there-but-animating-anyway flicker this is guarding against. Keyed only on the steps
  // themselves, the sync instead waits for that reload to actually finish, by which point the
  // server's order already matches what the drag left locally, so there is nothing left to animate.
  const draggingScopeRef = useRef<ArrivalScope | null>(null);
  useEffect(() => {
    draggingScopeRef.current = draggingScope;
  }, [draggingScope]);

  // The local order tracks the server's own at all times, except in whichever scope is currently
  // being dragged — there the pointer is in charge until it lets go, so a row does not get pulled
  // out from under the cursor by a refetch landing mid-drag.
  // Deferred to a microtask so this is not a synchronous setState inside the effect body, which
  // `react-hooks/set-state-in-effect` rejects.
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (draggingScopeRef.current === "company") return;
      setCompanyOrder(companySteps.map((step) => step.key));
    });
  }, [companySteps]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (draggingScopeRef.current === "project") return;
      setProjectOrder(projectSteps.map((step) => step.key));
    });
  }, [projectSteps]);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  if (companySteps.length === 0 && projectSteps.length === 0) {
    return <EmptyState size="sm">No steps here yet.</EmptyState>;
  }

  const effectiveCompanySteps = reorderByKeys(companySteps, companyOrder);
  const effectiveProjectSteps = reorderByKeys(projectSteps, projectOrder);

  const companyKeys = new Set(companySteps.map((step) => step.key));
  const overriddenKeys = hasProject ? new Set(projectSteps.map((step) => step.key)) : EMPTY_SET;

  // Row *position* follows the live order the whole time a drag is in progress, so the section
  // reorders in real time as the pointer crosses other rows. The *numbers* stay put until the
  // pointer is actually released: they are read from the order the server still has while that
  // scope is being dragged, and only pick up the live order again once the drag ends — by then the
  // final order is already what `company/projectOrder` holds, so the badges jump straight to it.
  const numberCompanySteps = draggingScope === "company" ? companySteps : effectiveCompanySteps;
  const numberProjectSteps = draggingScope === "project" ? projectSteps : effectiveProjectSteps;

  const numberByKey = new Map<string, number | null>();
  {
    let running = 0;
    for (const step of numberCompanySteps) {
      const replaced = overriddenKeys.has(step.key);
      numberByKey.set(step.key, replaced ? null : ++running);
    }
    if (hasProject) {
      for (const step of numberProjectSteps) {
        numberByKey.set(step.key, ++running);
      }
    }
  }

  const companyEntries: StepEntry[] = effectiveCompanySteps.map((step, index) => {
    const replaced = overriddenKeys.has(step.key);
    return {
      step,
      scope: "company",
      replaced,
      isOverride: false,
      number: numberByKey.get(step.key) ?? null,
      canMoveUp: !replaced && index > 0,
      canMoveDown: !replaced && index < effectiveCompanySteps.length - 1,
    };
  });
  const projectEntries: StepEntry[] = hasProject
    ? effectiveProjectSteps.map((step, index) => ({
        step,
        scope: "project" as const,
        replaced: false,
        isOverride: companyKeys.has(step.key),
        number: numberByKey.get(step.key) ?? null,
        canMoveUp: index > 0,
        canMoveDown: index < effectiveProjectSteps.length - 1,
      }))
    : [];

  const registerRow = (id: string, element: HTMLElement | null) => {
    if (element) rowElements.current.set(id, element);
    else rowElements.current.delete(id);
  };

  const settle = (id: string) => {
    setJustDroppedRowId(id);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(() => setJustDroppedRowId(null), 650);
  };

  /** Called on every pointer-move frame a drag is live for. Finds which other row in the same
   * section the one in hand now sits over — by its measured center, not by whichever element the
   * pointer happens to be over — and, past the cooldown, moves it there. */
  const handleRowDrag = (key: string, scope: ArrivalScope) => {
    const dragged = rowElements.current.get(rowId(scope, key));
    if (!dragged) return;

    const now = performance.now();
    if (now - lastMoveAt.current < MOVE_COOLDOWN_MS) return;

    const { x, y } = centerOf(dragged);
    const order = scope === "company" ? companyOrder : projectOrder;
    const setOrder = scope === "company" ? setCompanyOrder : setProjectOrder;

    for (const candidateKey of order) {
      if (candidateKey === key) continue;
      const candidate = rowElements.current.get(rowId(scope, candidateKey));
      if (candidate && contains(candidate, x, y)) {
        setOrder((current) => moveTo(current, key, candidateKey));
        lastMoveAt.current = now;
        return;
      }
    }
  };

  const handleRowDragStart = (key: string, scope: ArrivalScope) => {
    lastMoveAt.current = 0;
    setDraggingRowId(rowId(scope, key));
    setDraggingScope(scope);
  };

  const handleRowDragEnd = (key: string, scope: ArrivalScope) => {
    setDraggingRowId(null);
    setDraggingScope(null);

    const finalOrder = scope === "company" ? companyOrder : projectOrder;
    const serverOrder = (scope === "company" ? companySteps : projectSteps).map((step) => step.key);
    if (!sameKeys(finalOrder, serverOrder)) {
      onReorder(finalOrder, scope);
      settle(rowId(scope, key));
    }
  };

  const projectDisplayName = projectName ?? "this project";

  return (
    <div className="space-y-4">
      {hasProject && <ThreadSectionLabel text="For everyone" />}
      <ThreadSection
        entries={companyEntries}
        scope="company"
        readOnly={readOnly}
        projectName={projectName}
        draggingRowId={draggingRowId}
        justDroppedRowId={justDroppedRowId}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
        registerRow={registerRow}
        onDragStartRow={(key) => handleRowDragStart(key, "company")}
        onDragRow={(key) => handleRowDrag(key, "company")}
        onDragEndRow={(key) => handleRowDragEnd(key, "company")}
        onMove={(key, direction) => onMove(key, direction, "company")}
        onEdit={(step) => onEdit(step, "company")}
      />

      {hasProject &&
        (projectEntries.length > 0 ? (
          <>
            <ThreadSectionLabel text={`Only in ${projectDisplayName}`} />
            <ThreadSection
              entries={projectEntries}
              scope="project"
              readOnly={readOnly}
              projectName={projectName}
              draggingRowId={draggingRowId}
              justDroppedRowId={justDroppedRowId}
              prefersReducedMotion={Boolean(prefersReducedMotion)}
              registerRow={registerRow}
              onDragStartRow={(key) => handleRowDragStart(key, "project")}
              onDragRow={(key) => handleRowDrag(key, "project")}
              onDragEndRow={(key) => handleRowDragEnd(key, "project")}
              onMove={(key, direction) => onMove(key, direction, "project")}
              onEdit={(step) => onEdit(step, "project")}
            />
          </>
        ) : (
          <ThreadSectionLabel text={`Nothing extra for ${projectDisplayName} yet`} muted />
        ))}
    </div>
  );
}

function ThreadSectionLabel({ text, muted = false }: { text: string; muted?: boolean }) {
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

/**
 * One section's rows, plus the single line that threads through them.
 *
 * The line is one static element spanning the section top to bottom, not a segment stitched onto
 * each row and not measured against where any one card's number happens to sit — a reorder only
 * ever moves the numbers and cards across it, and the line itself never moves or resizes along
 * with them.
 */
function ThreadSection({
  entries,
  scope,
  readOnly,
  projectName,
  draggingRowId,
  justDroppedRowId,
  prefersReducedMotion,
  registerRow,
  onDragStartRow,
  onDragRow,
  onDragEndRow,
  onMove,
  onEdit,
}: {
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
}) {
  return (
    <ol className="relative flex list-none flex-col gap-3">
      {entries.length > 1 && (
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
      )}
      {entries.map((entry) => (
        <ThreadRow
          key={entry.step.key}
          entry={entry}
          readOnly={readOnly}
          projectName={projectName}
          isDraggingThis={draggingRowId === rowId(scope, entry.step.key)}
          justDropped={justDroppedRowId === rowId(scope, entry.step.key)}
          prefersReducedMotion={prefersReducedMotion}
          registerElement={(element) => registerRow(rowId(scope, entry.step.key), element)}
          onDragStart={() => onDragStartRow(entry.step.key)}
          onDrag={() => onDragRow(entry.step.key)}
          onDragEnd={() => onDragEndRow(entry.step.key)}
          onMove={(direction) => onMove(entry.step.key, direction)}
          onEdit={() => onEdit(entry.step)}
        />
      ))}
    </ol>
  );
}

function ThreadRow({
  entry,
  readOnly,
  projectName,
  isDraggingThis,
  justDropped,
  prefersReducedMotion,
  registerElement,
  onDragStart,
  onDrag,
  onDragEnd,
  onMove,
  onEdit,
}: {
  entry: StepEntry;
  readOnly: boolean;
  projectName: string | null;
  isDraggingThis: boolean;
  justDropped: boolean;
  prefersReducedMotion: boolean;
  registerElement: (element: HTMLElement | null) => void;
  onDragStart: () => void;
  onDrag: () => void;
  onDragEnd: () => void;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
}) {
  const dragControls = useDragControls();
  const draggable = !readOnly && !entry.replaced;

  return (
    <motion.li
      ref={registerElement}
      layout={!prefersReducedMotion}
      transition={LAYOUT_TRANSITION}
      drag={draggable ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      className={`relative z-10 flex gap-3 ${isDraggingThis ? "z-20 cursor-grabbing" : ""}`}
      style={isDraggingThis ? { touchAction: "none" } : undefined}
    >
      <div className="relative flex w-8 shrink-0 items-center justify-center">
        {entry.number !== null ? (
          <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-app-brand bg-app-surface text-sm font-bold text-app-brand-text">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={entry.number}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.7 }}
                transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
              >
                {entry.number}
              </motion.span>
            </AnimatePresence>
          </span>
        ) : (
          <span aria-hidden="true" className="relative z-10 h-2 w-2 rounded-full bg-app-border" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <StepRow
          step={entry.step}
          readOnly={readOnly}
          replaced={entry.replaced}
          isOverride={entry.isOverride}
          projectName={projectName}
          draggable={draggable}
          isDragging={isDraggingThis}
          justDropped={justDropped}
          canMoveUp={entry.canMoveUp}
          canMoveDown={entry.canMoveDown}
          onMove={onMove}
          onEdit={onEdit}
          onHandlePointerDown={(event) => dragControls.start(event)}
        />
      </div>
    </motion.li>
  );
}

function StepRow({
  step,
  readOnly,
  replaced,
  isOverride,
  projectName,
  draggable,
  isDragging,
  justDropped,
  canMoveUp,
  canMoveDown,
  onMove,
  onEdit,
  onHandlePointerDown,
}: {
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
}) {
  const howItsDone = howStepGetsDone(step);
  const HowItsDoneIcon = howItsDone.icon;

  return (
    <div
      className={`group/step relative flex-1 rounded-2xl border p-3 transition duration-500 ${
        replaced
          ? "border-dashed border-app-border bg-app-surface-muted"
          : "border-app-border bg-app-surface"
      } ${isDragging ? "border-app-brand shadow-lg ring-2 ring-app-brand-glow" : ""} ${
        justDropped ? "border-app-brand ring-2 ring-app-brand-glow" : ""
      }`}
    >
      {/* Covers the whole card so clicking anywhere on it opens the edit drawer; the controls
          below sit in their own layer (pointer-events-auto) so they still catch their own clicks
          first. The handle below starts its own drag through `dragControls`, so it keeps working
          sitting in that same clickable layer above this overlay. */}
      {!readOnly && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit "${step.title}"`}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        />
      )}

      <div className="pointer-events-none relative z-10 flex items-start gap-2">
        {draggable && (
          <span
            onPointerDown={onHandlePointerDown}
            className="pointer-events-auto touch-none select-none"
          >
            <DragHandle visibleClassName="group-hover/step:mr-1 group-hover/step:w-4 group-hover/step:opacity-100 group-hover/step:text-app-text-muted" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm ${replaced ? "text-app-text-subtle line-through" : "font-medium text-app-text"}`}
          >
            {step.title}
          </p>
          {step.description && (
            <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>
          )}

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

        {!readOnly && !replaced && (
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
        )}

        {!readOnly && (
          <span className="pointer-events-none flex h-9 w-9 shrink-0 items-center justify-center text-app-text-disabled opacity-0 transition-opacity group-hover/step:opacity-100">
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
