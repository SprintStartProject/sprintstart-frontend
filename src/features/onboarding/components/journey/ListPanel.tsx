import type { ReactNode } from "react";
import { phaseItems, type PhaseItem } from "../../journey";
import type { OnboardingNextAction } from "../../nextAction";
import type { OnboardingPhaseEndpoint } from "../../types";
import { PhaseChooser } from "./PhaseChooser";
import { PhaseHeaderCard } from "./PhaseHeaderCard";
import { PhaseItemList } from "./PhaseItemList";
import { PhaseNavigator } from "./PhaseNavigator";
import { UpNextCard } from "./UpNextCard";

type Props = {
  phases: OnboardingPhaseEndpoint[];
  selectedPhase: OnboardingPhaseEndpoint;
  nextAction: OnboardingNextAction | null;
  nextItemId: string | null;
  focusPhaseId: string | null;
  expandedItemId: string | null;
  linkedItemId: string | null;
  onLinkHighlightEnd: () => void;
  onChoosePhase: (phaseId: string) => void;
  onSelectPhase: (phaseId: string) => void;
  onToggle: (item: PhaseItem) => void;
  onPrimary: (item: PhaseItem) => void;
  renderExpanded: (item: PhaseItem) => ReactNode;
  renderBuddy: (isEmpty: boolean) => ReactNode;
};

/** The chooser or the one thing to do next, on top of everything else. */
function NextUp(props: Props) {
  const { nextAction, phases, nextItemId } = props;
  if (nextAction?.kind === "choose") {
    return (
      <div id="phase-chooser">
        <PhaseChooser
          phases={nextAction.phases}
          allPhases={phases}
          onChoose={props.onChoosePhase}
        />
      </div>
    );
  }
  if (nextAction?.kind !== "step" && nextAction?.kind !== "question") return null;
  return (
    <UpNextCard
      phase={nextAction.phase}
      phaseIndex={phases.findIndex((phase) => phase.id === nextAction.phase.id)}
      item={phaseItems(nextAction.phase).find((item) => item.id === nextItemId)}
      onPrimary={props.onPrimary}
      onShowPhase={() => props.onSelectPhase(nextAction.phase.id)}
    />
  );
}

/**
 * The list view: what is up next, the phases on the left grouped by where the hire stands with
 * them, and the selected phase's header and items on the right.
 */
export function ListPanel(props: Props) {
  const { phases, selectedPhase, focusPhaseId } = props;
  return (
    <div className="space-y-5">
      <NextUp {...props} />
      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <PhaseNavigator
          phases={phases}
          selectedPhaseId={selectedPhase.id}
          focusPhaseId={focusPhaseId}
          onSelect={props.onSelectPhase}
          showUpdates
          className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[44rem]"
        />
        <section aria-labelledby="phase-title" className="min-w-0 space-y-4">
          <PhaseHeaderCard
            phase={selectedPhase}
            phases={phases}
            isFocus={selectedPhase.id === focusPhaseId}
            onSelectPhase={props.onSelectPhase}
            renderBuddy={props.renderBuddy}
          />
          <PhaseItemList
            phase={selectedPhase}
            nextItemId={props.nextItemId}
            expandedItemId={props.expandedItemId}
            linkedItemId={props.linkedItemId}
            onLinkHighlightEnd={props.onLinkHighlightEnd}
            onToggle={props.onToggle}
            onPrimary={props.onPrimary}
            renderExpanded={props.renderExpanded}
          />
        </section>
      </div>
    </div>
  );
}
