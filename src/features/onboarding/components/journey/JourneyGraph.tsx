import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Move,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "../../../../context/useToast";
import {
  blockingPhases,
  isItemComplete,
  itemState,
  phaseItems,
  phaseProgress,
  phaseState,
  type PhaseItem,
} from "../../journey";
import {
  CanvasButton,
  JourneyCanvas,
  type JourneyCameraHandle,
  type JourneyEdgeTone,
} from "../../graph/JourneyCanvas";
import { ItemNodeCard, PhaseNodeCard } from "../../graph/JourneyNodeCards";
import {
  ITEM_LAYOUT,
  ITEM_NODE_SIZE,
  PHASE_LAYOUT,
  PHASE_NODE_SIZE,
  itemGraphLayout,
} from "../../graph/graphLayouts";
import { phaseStateLabel } from "../../graph/nodeLabels";
import {
  layeredLayout,
  resolveLayout,
  wouldCreateCycle,
  type GraphPoint,
} from "../../graph/layout";
import type { OnboardingPhaseEndpoint } from "../../types";
import type { GraphNodePosition } from "../../../../services/onboardingGraphService";

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
  /** Adds a blank step to a phase at a point of its graph. */
  addStep: (phaseId: string, position: GraphPoint) => Promise<void>;
};

type Props = {
  phases: OnboardingPhaseEndpoint[];
  /** The phase zoomed into, or null for the journey map. */
  openPhaseId: string | null;
  onOpenPhaseChange: (phaseId: string | null) => void;
  /** The phase the member was last busy in; marked on the map. */
  focusPhaseId: string | null;
  /** The item the member should do next; marked inside its phase. */
  nextItemId?: string | null;
  /** Persist positions. Absent means the layout can only be changed for this visit. */
  saveLayout?: {
    phase: (phaseId: string, nodes: GraphNodePosition[]) => Promise<void>;
    path: (nodes: GraphNodePosition[]) => Promise<void>;
  };
  /** Rewire edges and add steps -- the PM's tools. */
  editing?: GraphEditing;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  /** Double click or Enter on an item. */
  onOpenItem?: (item: PhaseItem) => void;
  /** Details of the selected item, drawn over the canvas. */
  renderItemAside?: (item: PhaseItem, phase: OnboardingPhaseEndpoint) => ReactNode;
  /** Extra controls in the phase's title card, e.g. the PM's question tools. */
  renderPhaseActions?: (phase: OnboardingPhaseEndpoint) => ReactNode;
  heightClassName?: string;
};

const PHASE_KEY = (id: string) => `phase:${id}`;
const MAP_KEY = "journey";

/**
 * A path as one zoomable graph: the journey map of all phases, and inside every phase the graph of
 * its steps and questions.
 *
 * Steps live *in* phases, so the two graphs are not two tabs but two depths of the same picture. Every
 * phase card on the map already shows a small drawing of its own graph; clicking it flies the camera
 * into the card and lands on that graph, and "Journey map" flies back out to where it came from.
 *
 * Shared by the hire's page and the PM's member view. Both read; the hire may *arrange* their own
 * graph, and the PM additionally gets `editing` to change what waits on what and to add steps.
 */
export function JourneyGraph({
  phases,
  openPhaseId,
  onOpenPhaseChange,
  focusPhaseId,
  nextItemId = null,
  saveLayout,
  editing,
  selectedItemId,
  onSelectItem,
  onOpenItem,
  renderItemAside,
  renderPhaseActions,
  heightClassName = "h-[calc(100vh-15rem)] min-h-[32rem]",
}: Props) {
  const toast = useToast();
  const mapCamera = useRef<JourneyCameraHandle>(null);
  const phaseCamera = useRef<JourneyCameraHandle>(null);
  const [arranging, setArranging] = useState(false);
  const [divingInto, setDivingInto] = useState<string | null>(null);
  const [surfacedFrom, setSurfacedFrom] = useState<string | null>(null);
  // Moves shown before the server has them, keyed per graph; dropped when fresh data arrives.
  const [overrides, setOverrides] = useState<Record<string, Record<string, GraphPoint>>>({});
  const [lastPhases, setLastPhases] = useState(phases);
  if (lastPhases !== phases) {
    setLastPhases(phases);
    setOverrides({});
  }

  // The way out only starts from a phase once; a later visit to the map opens on the whole map.
  useEffect(() => {
    if (!surfacedFrom) return;
    const timer = window.setTimeout(() => setSurfacedFrom(null), 900);
    return () => window.clearTimeout(timer);
  }, [surfacedFrom]);

  const openPhase = phases.find((phase) => phase.id === openPhaseId) ?? null;
  const graphKey = openPhase ? PHASE_KEY(openPhase.id) : MAP_KEY;

  const phaseNodes = useMemo<PhaseNode[]>(
    () =>
      phases.map((phase, index) => ({
        id: phase.id,
        blockerIds: phase.blockerIds ?? [],
        graphX: phase.graphX ?? null,
        graphY: phase.graphY ?? null,
        phase,
        index,
      })),
    [phases],
  );
  const items = useMemo(() => (openPhase ? phaseItems(openPhase) : []), [openPhase]);

  const { positions, isAutomatic } = useMemo(() => {
    const resolved = openPhase
      ? itemGraphLayout(openPhase)
      : resolveLayout(phaseNodes, PHASE_LAYOUT, PHASE_NODE_SIZE);
    const local = overrides[graphKey];
    if (!local) return resolved;
    const merged = new Map(resolved.positions);
    Object.entries(local).forEach(([id, point]) => merged.set(id, point));
    return { positions: merged, isAutomatic: resolved.isAutomatic };
  }, [graphKey, openPhase, overrides, phaseNodes]);

  const canArrange = !!saveLayout || !!editing;

  // ── Navigation ─────────────────────────────────────────────

  const dive = async (phaseId: string) => {
    if (divingInto) return;
    setDivingInto(phaseId);
    await mapCamera.current?.zoomIntoNode(phaseId);
    setDivingInto(null);
    setArranging(false);
    onSelectItem(null);
    onOpenPhaseChange(phaseId);
  };

  const surface = () => {
    setSurfacedFrom(openPhaseId);
    setArranging(false);
    onSelectItem(null);
    onOpenPhaseChange(null);
  };

  // ── Editing ────────────────────────────────────────────────

  const persist = async (next: Map<string, GraphPoint>, changedIds: string[]) => {
    const previous = overrides[graphKey];
    setOverrides((current) => ({
      ...current,
      [graphKey]: { ...(current[graphKey] ?? {}), ...Object.fromEntries(next) },
    }));
    if (!saveLayout) return;
    const nodes = (isAutomatic || changedIds.length === 0 ? [...next.keys()] : changedIds).map(
      (id) => ({ id, graphX: next.get(id)!.x, graphY: next.get(id)!.y }),
    );
    try {
      if (openPhase) await saveLayout.phase(openPhase.id, nodes);
      else await saveLayout.path(nodes);
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
    void persist(
      openPhase ? layeredLayout(items, ITEM_LAYOUT) : layeredLayout(phaseNodes, PHASE_LAYOUT),
      [],
    );
  };

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(failure, { description: error instanceof Error ? error.message : undefined });
    }
  };

  const connect = (blockerId: string, nodeId: string) => {
    if (!editing) return;
    const nodes = openPhase ? items : phaseNodes;
    if (wouldCreateCycle(nodes, nodeId, blockerId)) {
      toast.warning("That connection would make a loop", {
        description: "Something it unlocks already waits on it.",
      });
      return;
    }
    void run(
      () =>
        openPhase
          ? editing.connectItems(openPhase.id, blockerId, nodeId)
          : editing.connectPhases(blockerId, nodeId),
      "Couldn't connect them",
    );
  };

  const disconnect = (blockerId: string, nodeId: string) => {
    if (!editing) return;
    void run(
      () =>
        openPhase
          ? editing.disconnectItems(openPhase.id, blockerId, nodeId)
          : editing.disconnectPhases(blockerId, nodeId),
      "Couldn't remove the connection",
    );
  };

  const addStepAt = (point: GraphPoint) => {
    if (!editing || !openPhase) return;
    const phaseId = openPhase.id;
    // Never on top of a card: slide down until the spot is free.
    const spot = { ...point };
    const taken = [...positions.values()];
    while (
      taken.some(
        (other) =>
          Math.abs(other.x - spot.x) < ITEM_NODE_SIZE.width + 16 &&
          Math.abs(other.y - spot.y) < ITEM_NODE_SIZE.height + 16,
      )
    ) {
      spot.y += ITEM_NODE_SIZE.height + 32;
    }
    void run(async () => {
      // A graph still on its automatic layout ignores one pinned node, so pin what is on screen
      // first -- otherwise the new step would not appear where it was put.
      if (isAutomatic && saveLayout && items.length > 0) {
        await saveLayout.phase(
          phaseId,
          [...positions].map(([id, position]) => ({ id, graphX: position.x, graphY: position.y })),
        );
      }
      await editing.addStep(phaseId, spot);
    }, "Couldn't add the step");
  };

  const arrangeTools = canArrange ? (
    <>
      <CanvasButton
        label={
          arranging
            ? "Done arranging"
            : editing
              ? "Edit: move nodes and draw connections"
              : "Arrange nodes"
        }
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

  // ── The journey map ────────────────────────────────────────

  if (!openPhase) {
    return (
      <JourneyCanvas
        key="map"
        cameraRef={mapCamera}
        nodes={phaseNodes}
        positions={positions}
        nodeSize={PHASE_NODE_SIZE}
        ariaLabel="Journey map of all onboarding phases. Open a phase to see its steps."
        nodeLabel={(node) =>
          `Phase ${node.index + 1}: ${node.phase.title}, ${phaseStateLabel[phaseState(node.phase)]}, ${phaseProgress(node.phase).percentage}% complete`
        }
        fitKey={MAP_KEY}
        focusId={focusPhaseId}
        enterFromId={surfacedFrom}
        spotlightId={divingInto}
        onSelect={(id) => {
          // While arranging a click is part of moving things around; a double click still opens.
          if (id && !arranging) void dive(id);
        }}
        onOpen={(id) => void dive(id)}
        edgeTone={(blocker, node) => {
          const blockerState = phaseState(blocker.phase);
          if (blockerState !== "done") return "waiting";
          const nodeState = phaseState(node.phase);
          return nodeState === "open" || nodeState === "active" ? "active" : "done";
        }}
        canMove={arranging}
        onMove={handleMove}
        canConnect={!!editing && arranging}
        onConnect={connect}
        onDisconnect={editing ? disconnect : undefined}
        overlay={
          <div className="flex items-center gap-2 rounded-2xl border border-app-border/70 bg-app-surface/90 px-3 py-2 shadow-lg backdrop-blur-md">
            <MapIcon className="h-4 w-4 text-app-brand-text" aria-hidden="true" />
            <span className="text-sm font-semibold text-app-text">Journey map</span>
            <span className="hidden text-xs text-app-text-subtle sm:inline">
              {arranging
                ? editing
                  ? "· Drag phases, or from a phase’s port to what it unlocks"
                  : "· Drag phases to arrange them"
                : "· Click a phase to step inside"}
            </span>
          </div>
        }
        toolbar={arrangeTools}
        heightClassName={heightClassName}
        renderNode={(node, render) => (
          <PhaseNodeCard
            index={node.index}
            phase={node.phase}
            state={phaseState(node.phase)}
            render={render}
            isFocus={node.id === focusPhaseId}
          />
        )}
      />
    );
  }

  // ── Inside a phase ─────────────────────────────────────────

  const index = phases.indexOf(openPhase);
  const state = phaseState(openPhase);
  const waitsOn = blockingPhases(openPhase, phases);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const progress = phaseProgress(openPhase);

  return (
    <motion.div
      key={openPhase.id}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <JourneyCanvas
        key={openPhase.id}
        cameraRef={phaseCamera}
        nodes={items}
        positions={positions}
        nodeSize={ITEM_NODE_SIZE}
        ariaLabel={`Graph of the steps and questions in ${openPhase.title}`}
        nodeLabel={(item) => `${item.kind === "step" ? "Step" : "Question"}: ${item.title}`}
        fitKey={PHASE_KEY(openPhase.id)}
        focusId={nextItemId ?? selectedItemId}
        selectedId={selectedItemId}
        onSelect={onSelectItem}
        onOpen={(id) => {
          const item = items.find((candidate) => candidate.id === id);
          if (item) onOpenItem?.(item);
        }}
        edgeTone={(blocker, node): JourneyEdgeTone => {
          const blockerState = itemState(blocker, openPhase.locked);
          const nodeState = itemState(node, openPhase.locked);
          if (!isItemComplete(blockerState)) return "waiting";
          return !isItemComplete(nodeState) && nodeState !== "locked" ? "active" : "done";
        }}
        canMove={arranging}
        onMove={handleMove}
        canConnect={!!editing && arranging}
        onConnect={connect}
        onDisconnect={editing ? disconnect : undefined}
        onCanvasDoubleClick={editing ? addStepAt : undefined}
        overlay={
          <div className="max-w-[min(34rem,calc(100vw-4rem))] rounded-2xl border border-app-border/70 bg-app-surface/90 p-2 pr-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={surface}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Journey map
              </button>
              <ChevronRight className="h-4 w-4 shrink-0 text-app-text-subtle" aria-hidden="true" />
              <h3 className="min-w-0 truncate text-sm font-semibold text-app-text">
                <span className="text-app-text-subtle tabular-nums">{index + 1}.</span>{" "}
                {openPhase.title}
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-2 text-xs text-app-text-muted">
              <span className="font-medium">{phaseStateLabel[state]}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {progress.completed}/{progress.total} done
              </span>
              {waitsOn.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Opens after {waitsOn.map((phase) => phase.title).join(", ")}
                </span>
              ) : null}
            </div>
            {renderPhaseActions ? (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-2">
                {renderPhaseActions(openPhase)}
              </div>
            ) : null}
          </div>
        }
        toolbar={
          <>
            {editing ? (
              <CanvasButton
                label="Add a blank step"
                onClick={() => addStepAt(phaseCamera.current?.viewCenter() ?? { x: 0, y: 0 })}
              >
                <Plus className="h-4 w-4" />
              </CanvasButton>
            ) : null}
            {arrangeTools}
          </>
        }
        heightClassName={heightClassName}
        aside={
          selectedItem && renderItemAside ? renderItemAside(selectedItem, openPhase) : undefined
        }
        renderNode={(item, render) => (
          <ItemNodeCard
            item={item}
            state={itemState(item, openPhase.locked)}
            render={render}
            isNext={item.id === nextItemId}
          />
        )}
      />
    </motion.div>
  );
}
