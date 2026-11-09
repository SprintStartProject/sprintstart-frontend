import { motion } from "framer-motion";
import { ChevronRight, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import { useDialogFocus } from "../../../../../components/ui/useDialogFocus";
import { itemState, type PhaseItem } from "../../../journey";
import { ItemGlyph } from "../../../graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel } from "../../../graph/nodeLabels";
import type { OnboardingPhaseEndpoint } from "../../../../../services/onboardingTypes";

type ItemFocusProps = {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  phaseIndex: number;
  onBack: () => void;
  onJourneyMap: () => void;
  children: ReactNode;
};

/** The way back out along the top: journey map, then the phase. */
function FocusBreadcrumb({
  phase,
  phaseIndex,
  onBack,
  onJourneyMap,
}: Pick<ItemFocusProps, "phase" | "phaseIndex" | "onBack" | "onJourneyMap">) {
  return (
    <nav
      aria-label="Where you are"
      className="flex min-w-0 items-center gap-1 text-xs text-app-text-muted"
    >
      <button
        type="button"
        onClick={onJourneyMap}
        className="shrink-0 rounded-md px-1.5 py-0.5 hover:bg-app-surface-hover hover:text-app-text"
      >
        Journey map
      </button>
      <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onBack}
        className="min-w-0 truncate rounded-md px-1.5 py-0.5 hover:bg-app-surface-hover hover:text-app-text"
      >
        {phaseIndex + 1}. {phase.title}
      </button>
    </nav>
  );
}

function FocusHeader({
  item,
  phase,
  phaseIndex,
  onBack,
  onJourneyMap,
}: Omit<ItemFocusProps, "children">) {
  const state = itemState(item, phase.locked);
  const isQuestion = item.kind === "question";

  return (
    <header
      className={`border-b px-4 py-3 sm:px-6 ${
        isQuestion
          ? "border-app-question-border/60 bg-app-question-bg/50"
          : "border-app-border bg-app-brand-soft/30"
      }`}
    >
      <FocusBreadcrumb
        phase={phase}
        phaseIndex={phaseIndex}
        onBack={onBack}
        onJourneyMap={onJourneyMap}
      />
      <div className="mt-2 flex items-start gap-3">
        <ItemGlyph item={item} state={state} />
        <div className="min-w-0 flex-1">
          <p
            className={`text-2xs font-semibold tracking-wide uppercase ${
              isQuestion ? "text-app-question-text" : "text-app-brand-text"
            }`}
          >
            {isQuestion ? "Knowledge question" : itemKindLabel(item)} · {itemStateLabel[state]}
          </p>
          <h3 className="mt-0.5 text-lg leading-snug font-bold text-app-text sm:text-xl">
            {isQuestion ? item.question.question : item.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the phase"
          title="Back to the phase (Esc)"
          className="rounded-xl p-2 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
        >
          <Minimize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/**
 * A step or question zoomed into until it is the whole graph: the camera flies into the node, and the
 * node opens up into the thing itself, with the way back out along the top.
 */
export function ItemFocus({ children, ...header }: ItemFocusProps) {
  const isQuestion = header.item.kind === "question";
  // A step opened until it fills the canvas is a dialog: focus moves in, Tab stays inside, and it
  // goes back to the node on the way out, so reaching what had just been opened does not mean
  // tabbing past the rest of the graph.
  const pageRef = useDialogFocus<HTMLElement>(true);

  return (
    <div className="absolute inset-0 flex items-stretch justify-center bg-app-bg-soft/70 p-3 backdrop-blur-sm sm:p-6">
      <motion.section
        ref={pageRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${isQuestion ? "Question" : "Step"}: ${header.item.title}`}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-app-surface shadow-2xl outline-hidden ${
          isQuestion ? "border-app-question-border" : "border-app-brand-border"
        }`}
      >
        <FocusHeader {...header} />
        <div className="app-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>
      </motion.section>
    </div>
  );
}
