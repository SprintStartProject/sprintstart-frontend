import { CheckCircle2, ChevronDown, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { phaseItems, phaseProgress, phaseState, itemState, type PhaseState } from "../../journey";
import { ProgressRing } from "../../graph/JourneyNodeCards";
import { phaseStateLabel } from "../../graph/nodeLabels";
import type { OnboardingPhaseEndpoint } from "../../types";

type Props = {
  phases: OnboardingPhaseEndpoint[];
  selectedPhaseId: string;
  currentPhaseId: string | null;
  onSelect: (phaseId: string) => void;
  /** Heading above the list. */
  title?: string;
  /** Tailwind classes for the sticky offset and height, which depend on the page's header. */
  className?: string;
  /** Desktop only: just the progress rings, so a wide view (the graph) gets the room. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

function openCounts(phase: OnboardingPhaseEndpoint) {
  const items = phaseItems(phase).map((item) => itemState(item, phase.locked));
  return {
    openQuestions: phase.questions.filter((question) => question.status !== "PASSED").length,
    ready: items.filter((state) => state === "open" || state === "active" || state === "retry")
      .length,
  };
}

function RailRow({
  phase,
  index,
  state,
  selected,
  onSelect,
  compact,
}: {
  phase: OnboardingPhaseEndpoint;
  index: number;
  state: PhaseState;
  selected: boolean;
  onSelect: () => void;
  compact: boolean;
}) {
  const progress = phaseProgress(phase);
  const { ready } = openCounts(phase);

  if (compact) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Phase ${index + 1}: ${phase.title}, ${phaseStateLabel[state]}`}
        title={`${index + 1}. ${phase.title} · ${progress.completed}/${progress.total}`}
        onClick={onSelect}
        className={`flex w-full items-center justify-center rounded-2xl border py-2 transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
          selected
            ? "border-app-brand bg-app-brand-soft"
            : "border-transparent hover:bg-app-surface-hover"
        }`}
      >
        <ProgressRing
          value={progress.percentage}
          size={34}
          stroke={3.5}
          tone={state === "done" ? "success" : state === "locked" ? "muted" : "brand"}
        >
          {state === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-app-success-text" aria-hidden="true" />
          ) : state === "locked" ? (
            <Lock className="h-3 w-3 text-app-text-subtle" aria-hidden="true" />
          ) : (
            <span className="text-[11px] font-bold text-app-text tabular-nums">{index + 1}</span>
          )}
        </ProgressRing>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={state === "current" ? "step" : undefined}
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        selected
          ? "border-app-brand bg-app-brand-soft"
          : "border-transparent hover:border-app-border hover:bg-app-surface-hover"
      }`}
    >
      <ProgressRing
        value={progress.percentage}
        size={34}
        stroke={3.5}
        tone={state === "done" ? "success" : state === "locked" ? "muted" : "brand"}
      >
        {state === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-app-success-text" aria-hidden="true" />
        ) : state === "locked" ? (
          <Lock className="h-3 w-3 text-app-text-subtle" aria-hidden="true" />
        ) : (
          <span className="text-[11px] font-bold text-app-text tabular-nums">{index + 1}</span>
        )}
      </ProgressRing>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            state === "locked" ? "text-app-text-muted" : "text-app-text"
          }`}
        >
          {phase.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-app-text-subtle tabular-nums">
          <span>
            {progress.completed}/{progress.total}
          </span>
          {state === "current" ? (
            <span className="font-semibold text-app-brand-text">· You are here</span>
          ) : state === "locked" ? (
            <span>· Locked</span>
          ) : state === "open" && ready > 0 ? (
            <span>· {ready} ready</span>
          ) : null}
        </span>
      </span>
      <span className="sr-only">{phaseStateLabel[state]}</span>
    </button>
  );
}

/**
 * The list of phases beside a path, built for paths with many of them.
 *
 * Replaces a row of wide cards that scrolled sideways: with sixteen phases only four fitted, and
 * which one the hire was in was usually off screen. A vertical list shows every phase at once, each
 * with its progress ring and whether it is open, locked or where the hire is. Below `lg` it folds
 * into one button that opens the same list.
 */
export function PhaseRail({
  phases,
  selectedPhaseId,
  currentPhaseId,
  onSelect,
  title = "Phases",
  className = "",
  collapsed = false,
  onCollapsedChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<HTMLDivElement>(null);
  const done = phases.filter((phase) => phaseState(phase, currentPhaseId) === "done").length;
  const selectedIndex = phases.findIndex((phase) => phase.id === selectedPhaseId);
  const selected = phases[selectedIndex];

  // Keep the selected phase in view inside the rail's own scroller, without scrolling the page.
  useEffect(() => {
    const row = selectedRef.current;
    const scroller = row?.parentElement;
    if (!row || !scroller) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top - 8;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight + 8;
    }
  }, [selectedPhaseId]);

  const renderList = (compact: boolean) => (
    <div className="app-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      {phases.map((phase, index) => (
        <div key={phase.id} ref={phase.id === selectedPhaseId ? selectedRef : undefined}>
          <RailRow
            compact={compact}
            phase={phase}
            index={index}
            state={phaseState(phase, currentPhaseId)}
            selected={phase.id === selectedPhaseId}
            onSelect={() => {
              onSelect(phase.id);
              setOpen(false);
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <nav aria-label="Onboarding phases" className={className}>
      {/* Folded on small screens: one button naming the phase on screen. */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
              Phase {selectedIndex + 1} of {phases.length}
            </span>
            <span className="block truncate text-sm font-semibold text-app-text">
              {selected?.title}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {open ? (
          <div className="mt-2 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-xl">
            {renderList(false)}
          </div>
        ) : null}
      </div>

      <div className="hidden h-full flex-col overflow-hidden rounded-3xl border border-app-border bg-app-surface lg:flex">
        <div
          className={`flex items-center border-b border-app-border py-2 ${
            collapsed ? "justify-center px-1" : "justify-between gap-2 pr-2 pl-4"
          }`}
        >
          {collapsed ? null : (
            <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-app-text">
              {title}
              <span className="text-xs font-normal text-app-text-subtle tabular-nums">
                {done}/{phases.length} complete
              </span>
            </h2>
          )}
          {onCollapsedChange ? (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? "Expand phase list" : "Collapse phase list"}
              title={collapsed ? "Expand phase list" : "Collapse phase list"}
              className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
        {renderList(collapsed)}
      </div>
    </nav>
  );
}
