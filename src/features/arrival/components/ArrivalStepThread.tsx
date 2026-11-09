import { useReducedMotion } from "framer-motion";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { ArrivalScope, ArrivalStep } from "../../../services/arrivalTypes";
import { ThreadSection, ThreadSectionLabel } from "./thread/ThreadSection";
import { threadModel } from "./thread/threadRules";
import { useThreadOrder } from "./thread/useThreadOrder";

type ArrivalStepThreadProps = {
  companySteps: ArrivalStep[];
  projectSteps: ArrivalStep[];
  hasProject: boolean;
  projectName: string | null;
  readOnly: boolean;
  onMove: (key: string, direction: "up" | "down", scope: ArrivalScope) => void;
  onReorder: (orderedKeys: string[], scope: ArrivalScope) => void;
  onEdit: (step: ArrivalStep, scope: ArrivalScope) => void;
};

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
export function ArrivalStepThread(props: ArrivalStepThreadProps) {
  const { companySteps, projectSteps, hasProject, projectName, readOnly } = props;
  const prefersReducedMotion = useReducedMotion();
  const order = useThreadOrder({ companySteps, projectSteps, onReorder: props.onReorder });

  if (companySteps.length === 0 && projectSteps.length === 0) {
    return <EmptyState size="sm">No steps here yet.</EmptyState>;
  }

  const model = threadModel({
    companySteps,
    projectSteps,
    liveCompanySteps: order.effectiveCompanySteps,
    liveProjectSteps: order.effectiveProjectSteps,
    draggingScope: order.draggingScope,
    hasProject,
  });
  const projectDisplayName = projectName ?? "this project";

  const sectionProps = {
    readOnly,
    projectName,
    draggingRowId: order.draggingRowId,
    justDroppedRowId: order.justDroppedRowId,
    prefersReducedMotion: Boolean(prefersReducedMotion),
    registerRow: order.registerRow,
  };

  return (
    <div className="space-y-4">
      {hasProject && <ThreadSectionLabel text="For everyone" />}
      <ThreadSection
        {...sectionProps}
        entries={model.company}
        scope="company"
        onDragStartRow={(key) => order.startDrag(key, "company")}
        onDragRow={(key) => order.dragRow(key, "company")}
        onDragEndRow={(key) => order.endDrag(key, "company")}
        onMove={(key, direction) => props.onMove(key, direction, "company")}
        onEdit={(step) => props.onEdit(step, "company")}
      />

      {hasProject &&
        (model.project.length > 0 ? (
          <>
            <ThreadSectionLabel text={`Only in ${projectDisplayName}`} />
            <ThreadSection
              {...sectionProps}
              entries={model.project}
              scope="project"
              onDragStartRow={(key) => order.startDrag(key, "project")}
              onDragRow={(key) => order.dragRow(key, "project")}
              onDragEndRow={(key) => order.endDrag(key, "project")}
              onMove={(key, direction) => props.onMove(key, direction, "project")}
              onEdit={(step) => props.onEdit(step, "project")}
            />
          </>
        ) : (
          <ThreadSectionLabel text={`Nothing extra for ${projectDisplayName} yet`} muted />
        ))}
    </div>
  );
}
