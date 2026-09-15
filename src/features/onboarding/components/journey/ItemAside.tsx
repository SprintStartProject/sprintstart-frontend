import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ReactNode } from "react";
import { formatMinutes, itemState, phaseItems, unlockedBy, type PhaseItem } from "../../journey";
import { ItemKindIcon, itemKindLabel, itemStateLabel } from "../../graph/JourneyNodeCards";
import type { OnboardingPhaseEndpoint } from "../../types";

/**
 * The details of the item selected on a phase graph, drawn over the canvas.
 *
 * Shows both directions of the graph around it -- what it waits on and what it opens -- as links, so
 * the hire can walk the graph from here instead of hunting for the next node.
 */
export function ItemAside({
  item,
  phase,
  onClose,
  onSelect,
  actions,
  children,
}: {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  onClose: () => void;
  onSelect: (id: string) => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const items = phaseItems(phase);
  const state = itemState(item, phase.locked);
  const blockers = item.blockerIds
    .map((id) => items.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is PhaseItem => !!candidate);
  const unlocks = unlockedBy(item, items);
  const description =
    item.kind === "step"
      ? item.step.description
      : item.question.type === "MULTIPLE_CHOICE"
        ? "Pick the right answer to pass this question."
        : "Answer in a sentence or two; it is checked for meaning, not wording.";

  return (
    <aside
      aria-label={`Details: ${item.title}`}
      className="flex h-full max-h-full flex-col overflow-hidden rounded-3xl border border-app-border/80 bg-app-surface/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
            <ItemKindIcon item={item} className="h-3.5 w-3.5" />
            {itemKindLabel(item)}
            {item.kind === "step" && item.step.estimatedMinutes ? ` · ${formatMinutes(item.step.estimatedMinutes)}` : ""}
          </p>
          <h3 className="mt-1 text-base leading-snug font-semibold text-app-text">
            {item.kind === "question" ? item.question.question : item.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="app-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            state === "done"
              ? "bg-app-success-bg text-app-success-text"
              : state === "active" || state === "open"
                ? "bg-app-brand-soft text-app-brand-text"
                : state === "retry"
                  ? "bg-app-warning-bg text-app-warning-text"
                  : "bg-app-surface-muted text-app-text-muted"
          }`}
        >
          {itemStateLabel[state]}
        </span>

        {description ? <p className="leading-relaxed text-app-text-muted">{description}</p> : null}

        {children}

        <Neighbours
          title="Waits on"
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          items={blockers}
          phase={phase}
          empty="Nothing -- it is open as soon as its phase is."
          onSelect={onSelect}
        />
        <Neighbours
          title="Unlocks"
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          items={unlocks}
          phase={phase}
          empty="Nothing else in this phase waits on it."
          onSelect={onSelect}
        />
      </div>

      {actions ? <div className="flex flex-wrap gap-2 border-t border-app-border px-4 py-3">{actions}</div> : null}
    </aside>
  );
}

function Neighbours({
  title,
  icon,
  items,
  phase,
  empty,
  onSelect,
}: {
  title: string;
  icon: ReactNode;
  items: PhaseItem[];
  phase: OnboardingPhaseEndpoint;
  empty: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-semibold text-app-text-subtle">
        {icon}
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-app-text-subtle">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((neighbour) => (
            <li key={neighbour.id}>
              <button
                type="button"
                onClick={() => onSelect(neighbour.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-app-border px-2.5 py-1.5 text-left text-xs hover:border-app-brand-border hover:bg-app-surface-hover"
              >
                <span className="truncate text-app-text">{neighbour.title}</span>
                <span className="shrink-0 text-app-text-subtle">
                  {itemStateLabel[itemState(neighbour, phase.locked)]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
