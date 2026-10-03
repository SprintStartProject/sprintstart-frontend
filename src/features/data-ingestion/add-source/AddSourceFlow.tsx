import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { IconTile } from "../../../components/ui/IconTile.tsx";
import { SourceTypeStep } from "../components/SourceTypeStep.tsx";
import { getConnector } from "../connectors/registry.ts";
import type { DraftSource } from "../connectors/draft.ts";
import type { SourceSystem } from "../connectors/sourceSystems.ts";
import type { DraftFormContext } from "../connectors/types.ts";

/** The two screens of the add-source sub-flow: pick a type, then fill it in. */
export type AddSourceStep = "type" | "detail";

type AddSourceFlowProps = {
  step: AddSourceStep;
  selectedType: SourceSystem;
  onSelectType: (type: SourceSystem) => void;
  /** Returns from a type's detail screen to the type grid (the header's back). */
  onBack: () => void;
  isBusy?: boolean;
  /** What the form of the selected type needs to know about where it is used. */
  context: DraftFormContext;
  /** Must be stable (a state setter): the forms report on mount and on every change. */
  onDraftsChange: (drafts: DraftSource[]) => void;
  /** Enter in a form field stages the source (guarded), matching "Add to list". */
  onSubmit: () => void;
  /**
   * Told when the desktop credential companion opens/closes, so the wizard can
   * slide its modal left to make room for it.
   */
  onCompanionOpenChange?: (open: boolean) => void;
};

/**
 * The navigation header of a source's detail screen: a back control, then the
 * chosen type's icon, name and a short brief. Picking a type does not advance the
 * wizard's own stepper (it stays on "Sources") — choosing a type branches into
 * one of several forms rather than stepping forward — so this is master-detail:
 * paired with the slide-in, the title changing to the type name (with a back
 * arrow to the grid) reads as drilling into that source, not a step or a tab.
 */
function DetailHeader({ type, onBack }: { type: SourceSystem; onBack: () => void }) {
  const { meta, draft } = getConnector(type);
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 border-b border-app-border pb-4">
      <Button variant="ghost" size="sm" iconOnly onClick={onBack} aria-label="Back to source types">
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <IconTile icon={Icon} size="xl" tone="brand" />

      <div>
        <p className="text-[15px] font-semibold text-app-text">{meta.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-app-text-muted">{draft.formHint}</p>
      </div>
    </div>
  );
}

/**
 * The "Add source" sub-flow shown inside the wizard's Sources step and the Add
 * sources modal: a type grid that advances into the type-specific detail screen.
 * It stages a source rather than connecting one — the connector's own form (its
 * `draft.DraftForm`) captures what is needed and reports the drafts, and the host
 * adds them to its list when the user commits from the footer.
 *
 * The sub-flow owns no form state: which screen is shown lives with the host
 * (`useSourceDraftForm`), and each form holds its own fields. Choosing a type is
 * not a wizard step, so the detail screen carries its own header (the type's icon
 * and name) and slides in from the right — type sits on the left, detail on the
 * right — so it reads as drilling into that source rather than switching a tab or
 * advancing a step.
 */
export function AddSourceFlow({
  step,
  selectedType,
  onSelectType,
  onBack,
  isBusy = false,
  context,
  onDraftsChange,
  onSubmit,
  onCompanionOpenChange,
}: AddSourceFlowProps) {
  const prefersReducedMotion = useReducedMotion();
  const { DraftForm } = getConnector(selectedType).draft;

  const screen =
    step === "type" ? (
      <SourceTypeStep
        selectedType={selectedType}
        onSelectType={onSelectType}
        heading="Add a source"
        description="Which source type do you want to connect?"
      />
    ) : (
      <div className="space-y-5">
        <DetailHeader type={selectedType} onBack={onBack} />
        <DraftForm
          context={context}
          isBusy={isBusy}
          onDraftsChange={onDraftsChange}
          onSubmit={onSubmit}
          onCompanionOpenChange={onCompanionOpenChange}
        />
      </div>
    );

  // Type is the left page, detail the right one: advancing slides the incoming
  // screen in from the right and pushes the outgoing one left, and going back
  // reverses it, so the transition reads as moving between two pages.
  const offset = step === "type" ? -24 : 24;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
        {screen}
      </motion.div>
    </AnimatePresence>
  );
}
