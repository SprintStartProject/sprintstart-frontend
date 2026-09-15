import { LayoutGrid, Map as MapIcon, Move, Workflow } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { SegmentedTabs } from "../../../../components/ui/SegmentedTabs";
import { useToast } from "../../../../context/useToast";
import {
  itemState,
  isItemComplete,
  phaseItems,
  phaseProgress,
  phaseState,
  type ItemState,
  type PhaseItem,
} from "../../journey";
import { CanvasButton, JourneyCanvas, type JourneyEdgeTone } from "../../graph/JourneyCanvas";
import { ItemNodeCard, PhaseNodeCard } from "../../graph/JourneyNodeCards";
import { ITEM_NODE_SIZE, PHASE_NODE_SIZE } from "../../graph/nodeLabels";
import {
  layeredLayout,
  resolveLayout,
  wouldCreateCycle,
  type GraphPoint,
} from "../../graph/layout";
import type { OnboardingPhaseEndpoint } from "../../types";
import type { GraphNodePosition } from "../../../../services/onboardingGraphService";

export type GraphScope = "phase" | "journey";

type PhaseNode = {
  id: string;
  blockerIds: string[];
  graphX: number | null;
  graphY: number | null;
  phase: OnboardingPhaseEndpoint;
  index: number;
};

export type GraphEditing = {
  connectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
  disconnectItems: (phaseId: string, blockerId: string, nodeId: string) => Promise<void>;
  connectPhases: (blockerId: string, phaseId: string) => Promise<void>;
  disconnectPhases: (blockerId: string, phaseId: string) => Promise<void>;
  /** Double click on empty phase canvas. */
  addStepAt?: (phaseId: string, position: GraphPoint) => void;
};

type Props = {
  phases: OnboardingPhaseEndpoint[];
  selectedPhaseId: string;
  onSelectPhase: (phaseId: string) => void;
  scope: GraphScope;
  onScopeChange: (scope: GraphScope) => void;
  /** The item the member should do next; marked on the graph. */
  nextItemId?: string | null;
  /** The phase the member is in; marked on the journey map. */
  currentPhaseId: string | null;
  /** Persist positions. Absent means the layout can only be changed for this visit. */
  saveLayout?: {
    phase: (phaseId: string, nodes: GraphNodePosition[]) => Promise<void>;
    path: (nodes: GraphNodePosition[]) => Promise<void>;
  };
  /** Rewire edges and add steps -- the PM's tools. */
  editing?: GraphEditing;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onOpenItem?: (item: PhaseItem) => void;
  /** Details of the selected item, drawn over the canvas. */
  renderItemAside?: (item: PhaseItem, phase: OnboardingPhaseEndpoint) => ReactNode;
  heightClassName?: string;
  /** Short hint under the scope switch, e.g. what editing does. */
  hint?: ReactNode;
};

const tones = (state: ItemState): JourneyEdgeTone => (isItemComplete(state) ? "done" : "waiting");

/**
 * The graph half of the onboarding views: the journey map of all phases, and the graph of steps and
 * questions inside the selected phase -- one canvas, switched by a scope toggle.
 *
 * Shared by the hire's page and the PM's member view. Both read; the hire may *arrange* their own
 * graph, and the PM additionally gets `editing` to change what waits on what. Positions the graph
 * has never had are laid out automatically; the first move pins the whole graph, since a graph with
 * one stored position and nine computed ones would jump.
 */
export function PathGraphExplorer({
  phases,
  selectedPhaseId,
  onSelectPhase,
  scope,
  onScopeChange,
  nextItemId = null,
  currentPhaseId,
  saveLayout,
  editing,
  selectedItemId,
  onSelectItem,
  onOpenItem,
  renderItemAside,
  heightClassName = "h-[min(40rem,72vh)]",
  hint,
}: Props) {
  const toast = useToast();
  const [arranging, setArranging] = useState(false);
  // Moves shown before the server has them. Keyed per graph so a phase switch never carries a
  // position into another phase; cleared when the data that comes back already has them.
  const [overrides, setOverrides] = useState<Record<string, Record<string, GraphPoint>>>({});
  const [lastPhases, setLastPhases] = useState(phases);
  if (lastPhases !== phases) {
    setLastPhases(phases);
    setOverrides({});
  }

  const phase = phases.find((candidate) => candidate.id === selectedPhaseId) ?? phases[0];
  const items = useMemo(() => (phase ? phaseItems(phase) : []), [phase]);
  const phaseNodes = useMemo<PhaseNode[]>(
    () =>
      phases.map((candidate, index) => ({
        id: candidate.id,
        blockerIds: candidate.blockerIds ?? [],
        graphX: candidate.graphX ?? null,
        graphY: candidate.graphY ?? null,
        phase: candidate,
        index,
      })),
    [phases],
  );

  const graphKey = scope === "journey" ? "journey" : `phase:${phase?.id ?? ""}`;
  const graphNodes = scope === "journey" ? phaseNodes : items;
  const layoutOptions =
    scope === "journey"
      ? { columnGap: 300, rowGap: 170, maxPerRow: 4 }
      : { columnGap: 290, rowGap: 150, maxPerRow: 4 };

  const { positions, isAutomatic } = useMemo(() => {
    const resolved = resolveLayout(
      graphNodes,
      layoutOptions,
      scope === "journey" ? PHASE_NODE_SIZE : ITEM_NODE_SIZE,
    );
    const local = overrides[graphKey];
    if (!local) return resolved;
    const merged = new Map(resolved.positions);
    Object.entries(local).forEach(([id, point]) => merged.set(id, point));
    return { positions: merged, isAutomatic: resolved.isAutomatic };
    // layoutOptions is derived from scope, which graphKey already covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey, graphNodes, overrides]);

  const canArrange = !!saveLayout || !!editing;

  const persist = async (next: Map<string, GraphPoint>, changedIds: string[]) => {
    const previous = overrides[graphKey];
    setOverrides((current) => ({
      ...current,
      [graphKey]: { ...(current[graphKey] ?? {}), ...Object.fromEntries(next) },
    }));
    if (!saveLayout) return;
    const nodes = (isAutomatic || changedIds.length === 0 ? [...next.keys()] : changedIds).map(
      (id) => ({
        id,
        graphX: next.get(id)!.x,
        graphY: next.get(id)!.y,
      }),
    );
    try {
      if (scope === "journey") await saveLayout.path(nodes);
      else if (phase) await saveLayout.phase(phase.id, nodes);
    } catch (error) {
      setOverrides((current) => ({ ...current, [graphKey]: previous ?? {} }));
      toast.error("Couldn't save the layout", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleMove = (id: string, point: GraphPoint) => {
    const next = new Map(positions);
    next.set(id, point);
    void persist(next, [id]);
  };

  const tidy = () => {
    void persist(layeredLayout(graphNodes, layoutOptions), []);
  };

  const connect = async (blockerId: string, nodeId: string) => {
    if (!editing) return;
    if (wouldCreateCycle(graphNodes, nodeId, blockerId)) {
      toast.warning("That connection would make a loop", {
        description: "Something it unlocks already waits on it.",
      });
      return;
    }
    try {
      if (scope === "journey") await editing.connectPhases(blockerId, nodeId);
      else if (phase) await editing.connectItems(phase.id, blockerId, nodeId);
    } catch (error) {
      toast.error("Couldn't connect them", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const disconnect = async (blockerId: string, nodeId: string) => {
    if (!editing) return;
    try {
      if (scope === "journey") await editing.disconnectPhases(blockerId, nodeId);
      else if (phase) await editing.disconnectItems(phase.id, blockerId, nodeId);
    } catch (error) {
      toast.error("Couldn't remove the connection", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const focusId =
    scope === "journey" ? (currentPhaseId ?? phase?.id ?? null) : (nextItemId ?? selectedItemId);

  const scopeSwitch = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedTabs
        layoutId="journey-graph-scope"
        ariaLabel="Graph scope"
        value={scope}
        onChange={(next) => {
          onScopeChange(next);
          onSelectItem(null);
        }}
        options={[
          { value: "phase", label: "This phase", icon: <Workflow className="h-3.5 w-3.5" /> },
          { value: "journey", label: "Journey map", icon: <MapIcon className="h-3.5 w-3.5" /> },
        ]}
        className="shadow-lg"
      />
      {hint ? (
        <span className="hidden rounded-xl border border-app-border/70 bg-app-surface/85 px-3 py-2 text-xs text-app-text-muted backdrop-blur-md md:inline">
          {hint}
        </span>
      ) : null}
    </div>
  );

  const toolbar = canArrange ? (
    <>
      <CanvasButton
        label={arranging ? "Stop arranging" : "Arrange nodes"}
        active={arranging}
        onClick={() => setArranging((current) => !current)}
      >
        <Move className="h-4 w-4" />
      </CanvasButton>
      <CanvasButton label="Tidy up layout" onClick={tidy}>
        <LayoutGrid className="h-4 w-4" />
      </CanvasButton>
    </>
  ) : null;

  if (scope === "journey") {
    return (
      <JourneyCanvas
        nodes={phaseNodes}
        positions={positions}
        nodeSize={PHASE_NODE_SIZE}
        ariaLabel="Journey map of all onboarding phases"
        nodeLabel={(node) =>
          `Phase ${node.index + 1}: ${node.phase.title}, ${phaseProgress(node.phase).percentage}% complete`
        }
        fitKey={graphKey}
        focusId={focusId}
        selectedId={phase?.id ?? null}
        onSelect={(id) => {
          if (id) onSelectPhase(id);
        }}
        onOpen={(id) => {
          onSelectPhase(id);
          onScopeChange("phase");
        }}
        edgeTone={(blocker) =>
          phaseState(blocker.phase, currentPhaseId) === "done" ? "done" : "waiting"
        }
        canMove={arranging}
        onMove={handleMove}
        canConnect={!!editing && arranging}
        onConnect={(blockerId, nodeId) => void connect(blockerId, nodeId)}
        onDisconnect={
          editing ? (blockerId, nodeId) => void disconnect(blockerId, nodeId) : undefined
        }
        overlay={scopeSwitch}
        toolbar={toolbar}
        heightClassName={heightClassName}
        renderNode={(node, render) => (
          <PhaseNodeCard
            index={node.index}
            title={node.phase.title}
            state={phaseState(node.phase, currentPhaseId)}
            progress={phaseProgress(node.phase)}
            render={render}
          />
        )}
      />
    );
  }

  const phaseLocked = phase?.locked ?? false;

  return (
    <JourneyCanvas
      nodes={items}
      positions={positions}
      nodeSize={ITEM_NODE_SIZE}
      ariaLabel={`Graph of the steps and questions in ${phase?.title ?? "this phase"}`}
      nodeLabel={(item) => `${item.kind === "step" ? "Step" : "Question"}: ${item.title}`}
      fitKey={graphKey}
      focusId={focusId}
      selectedId={selectedItemId}
      onSelect={onSelectItem}
      onOpen={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (item) onOpenItem?.(item);
      }}
      edgeTone={(blocker, node) => {
        const blockerState = itemState(blocker, phaseLocked);
        const nodeState = itemState(node, phaseLocked);
        if (isItemComplete(blockerState) && !isItemComplete(nodeState) && nodeState !== "locked") {
          return "active";
        }
        return tones(blockerState);
      }}
      canMove={arranging}
      onMove={handleMove}
      canConnect={!!editing && arranging}
      onConnect={(blockerId, nodeId) => void connect(blockerId, nodeId)}
      onDisconnect={editing ? (blockerId, nodeId) => void disconnect(blockerId, nodeId) : undefined}
      onCanvasDoubleClick={
        editing?.addStepAt && phase ? (point) => editing.addStepAt!(phase.id, point) : undefined
      }
      overlay={scopeSwitch}
      toolbar={toolbar}
      heightClassName={heightClassName}
      aside={
        selectedItem && phase && renderItemAside ? renderItemAside(selectedItem, phase) : undefined
      }
      renderNode={(item, render) => (
        <ItemNodeCard
          item={item}
          state={itemState(item, phaseLocked)}
          render={render}
          isNext={item.id === nextItemId}
        />
      )}
    />
  );
}
