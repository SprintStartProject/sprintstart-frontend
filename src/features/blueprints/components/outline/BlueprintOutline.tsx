import { BookOpenCheck, ListChecks, Milestone, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import { EmptyState } from "../../../../components/ui/EmptyState.tsx";
import { PhasePrerequisites } from "../PhasePrerequisites.tsx";
import type { BlueprintPath, BlueprintPhase } from "../../types.ts";
import type { OutlineActions } from "./outlineActions.ts";
import { PhaseHeader } from "./PhaseHeader.tsx";
import { PhaseRequirements } from "./PhaseRequirements.tsx";
import { QuestionCard } from "./QuestionCard.tsx";
import { StepCard } from "./StepCard.tsx";

const byPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((a, b) => a.position - b.position);

interface PhaseProps {
  phase: BlueprintPhase;
  actions: OutlineActions;
}

function StepsColumn({ phase, actions }: PhaseProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-app-text">
          <ListChecks className="h-4 w-4 text-app-brand-text" /> Steps
        </h3>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => actions.openCreate("step", phase.id, phase.blueprintSteps.length)}
        >
          Add step
        </Button>
      </div>
      {phase.blueprintSteps.length === 0 ? (
        <EmptyState size="sm">No steps in this phase.</EmptyState>
      ) : (
        byPosition(phase.blueprintSteps).map((step, index) => (
          <StepCard key={step.id} step={step} index={index} actions={actions} />
        ))
      )}
    </div>
  );
}

function QuestionsColumn({ phase, actions }: PhaseProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-app-text">
          <BookOpenCheck className="h-4 w-4 text-app-brand-text" /> Knowledge check
        </h3>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            actions.openCreate("question", phase.id, phase.blueprintCheckQuestions.length)
          }
        >
          Add question
        </Button>
      </div>
      {phase.blueprintCheckQuestions.length === 0 ? (
        <EmptyState size="sm">No questions in this phase.</EmptyState>
      ) : (
        byPosition(phase.blueprintCheckQuestions).map((question, index) => (
          <QuestionCard key={question.id} question={question} index={index} actions={actions} />
        ))
      )}
    </div>
  );
}

function PhaseBody({ phase, phases, actions }: PhaseProps & { phases: BlueprintPhase[] }) {
  return (
    <>
      {/*
        The order the graph draws as arrows, written out. Without it the outline was a list of
        phases in `position` order and nothing else — and `position` is a suggestion, not a rule,
        so an author working from the list was reading an order the product does not actually
        enforce while the one it does enforce was only visible in the other view. Editable here
        too: the arrow is the same edge whichever end it is drawn from.
      */}
      <div className="mt-5 rounded-xl border border-app-border bg-app-surface-muted p-4">
        <PhasePrerequisites
          phase={phase}
          phases={phases}
          editable
          onAdd={(blocked, blockerId) =>
            actions.runGraphEdit(() => actions.addBlocker(blocked, blockerId))
          }
          onRemove={(blocked, blockerId) =>
            actions.runGraphEdit(() => actions.removeBlocker(blocked, blockerId))
          }
        />
      </div>
      <PhaseRequirements phase={phase} actions={actions} />
      {phase.type === "FIXED" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <StepsColumn phase={phase} actions={actions} />
          <QuestionsColumn phase={phase} actions={actions} />
        </div>
      ) : null}
    </>
  );
}

function PhaseCard({
  phase,
  phases,
  index,
  actions,
}: PhaseProps & { phases: BlueprintPhase[]; index: number }) {
  const collapsed = actions.phasesCollapsed.has(phase.id);
  return (
    <section
      {...actions.dragProps("phase", phase.id, index)}
      className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm"
    >
      <PhaseHeader phase={phase} collapsed={collapsed} actions={actions} />
      {!collapsed ? <PhaseBody phase={phase} phases={phases} actions={actions} /> : null}
    </section>
  );
}

function AddPhaseButton({
  path,
  actions,
  size,
}: {
  path: BlueprintPath;
  actions: OutlineActions;
  size?: "sm";
}) {
  return (
    <Button
      variant="secondary"
      size={size}
      icon={<Plus className="h-4 w-4" />}
      onClick={() => actions.openCreate("phase", path.id, path.blueprintPhases.length)}
    >
      Add phase
    </Button>
  );
}

/** The whole blueprint written out: its phases in order, each with what is inside it. */
export function BlueprintOutline({
  path,
  actions,
}: {
  path: BlueprintPath;
  actions: OutlineActions;
}) {
  const phases = path.blueprintPhases;
  return (
    <section className="space-y-5">
      {/*
        At the top as well as the bottom. A sixteen-phase blueprint is several screens of outline,
        and the only way to add a phase was to scroll past all of it — so adding one cost a journey
        through everything already written. Kept at the bottom too, because somebody who has just
        read to the end is also somebody about to add one.
      */}
      {phases.length > 0 && path.status === "DRAFT" ? (
        <div className="flex justify-end">
          <AddPhaseButton path={path} actions={actions} size="sm" />
        </div>
      ) : null}
      {phases.length === 0 ? (
        <EmptyState
          icon={<Milestone className="h-8 w-8" />}
          title="No phases yet"
          action={
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => actions.openCreate("phase", path.id, 0)}
            >
              Add phase
            </Button>
          }
        >
          Build the path in phases, then add steps and a knowledge check to each phase.
        </EmptyState>
      ) : (
        byPosition(phases).map((phase, index) => (
          <PhaseCard key={phase.id} phase={phase} phases={phases} index={index} actions={actions} />
        ))
      )}
      {phases.length > 0 ? <AddPhaseButton path={path} actions={actions} /> : null}
    </section>
  );
}
