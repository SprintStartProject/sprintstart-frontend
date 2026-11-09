import { Minus, Network, Pencil } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge.tsx";
import { Button } from "../../../../components/ui/Button.tsx";
import type { BlueprintPhase } from "../../types.ts";
import { CollapseToggle } from "./CollapseToggle.tsx";
import type { OutlineActions } from "./outlineActions.ts";

function AiPromptNote({ phase }: { phase: BlueprintPhase }) {
  if (phase.type !== "AI_ENHANCED" || !phase.aiPrompt) return null;
  return (
    <div className="mt-3 rounded-xl border border-app-warning-border bg-app-warning-bg p-3 text-sm">
      <p className="font-medium text-app-warning-text">AI prompt</p>
      <p className="mt-1 whitespace-pre-wrap text-app-text-muted">{phase.aiPrompt}</p>
    </div>
  );
}

function PhaseSummary({ phase, collapsed }: { phase: BlueprintPhase; collapsed: boolean }) {
  const isAi = phase.type === "AI_ENHANCED";
  return (
    <div className="min-w-0">
      {!collapsed ? (
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold tracking-wide text-app-brand-text uppercase">
            Phase {phase.position + 1}
          </p>
          <Badge variant={isAi ? "warning" : "neutral"}>{isAi ? "AI-enhanced" : "Fixed"}</Badge>
        </div>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold text-app-text">{phase.title}</h2>
      <p className="mt-1 text-sm text-app-text-muted">
        {phase.description || "No phase description."}
      </p>
      {!collapsed ? <AiPromptNote phase={phase} /> : null}
    </div>
  );
}

function PhaseToolbar({ phase, actions }: { phase: BlueprintPhase; actions: OutlineActions }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {/*
        The same phase, in the other view. Somebody reading down the outline who wants to see
        where a phase actually sits had to switch views and then find it again — two steps to ask
        one question about the thing already under their cursor.
      */}
      <Button
        aria-label={`Open phase ${phase.title} in the graph`}
        title="Open in the graph"
        iconOnly
        size="sm"
        variant="ghost"
        onClick={() => actions.openInGraph(phase.title)}
      >
        <Network className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Edit phase ${phase.title}`}
        iconOnly
        size="sm"
        variant="ghost"
        onClick={() => actions.whenEditable(() => actions.openEdit({ kind: "phase", item: phase }))}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Delete phase ${phase.title}`}
        iconOnly
        size="sm"
        variant="dangerGhost"
        loading={actions.deletingId === phase.id}
        onClick={() => actions.requestDelete("phase", phase.id, phase.title)}
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </Button>
    </div>
  );
}

interface PhaseHeaderProps {
  phase: BlueprintPhase;
  collapsed: boolean;
  actions: OutlineActions;
}

/** A phase's title row: the fold toggle, what it is, and what can be done to it. */
export function PhaseHeader({ phase, collapsed, actions }: PhaseHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <CollapseToggle
          collapsed={collapsed}
          kind="phase"
          name={phase.title}
          onToggle={() => actions.phasesCollapsed.toggle(phase.id)}
        />
        <PhaseSummary phase={phase} collapsed={collapsed} />
      </div>
      {!collapsed ? <PhaseToolbar phase={phase} actions={actions} /> : null}
    </div>
  );
}
