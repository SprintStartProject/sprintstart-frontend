import { motion } from "framer-motion";
import { EDGE_REFUSAL_MESSAGE, edgeRefusal } from "../../../graph-diagram/graphLayout";
import { phaseHasUnseenSkipAnswer } from "../../skipAnswers";
import {
  ArrowLeft,
  ChevronRight,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Minimize2,
  Move,
  ListPlus,
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
import { ItemGlyph, ItemNodeCard, PhaseNodeCard } from "../../graph/JourneyNodeCards";
import {
  ITEM_LAYOUT,
  ITEM_NODE_SIZE,
  PHASE_LAYOUT,
  PHASE_NODE_SIZE,
  itemGraphLayout,
} from "../../graph/graphLayouts";
import { itemKindLabel, itemStateLabel, phaseStateLabel } from "../../graph/nodeLabels";
import { layeredLayout, resolveLayout, type GraphPoint } from "../../graph/layout";
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
  /**
   * The item zoomed into until it fills the graph, and how to draw it. Given these, a click on an item
   * flies into it instead of selecting it -- the hire's way of working through a phase on the graph.
   */
  openItemId?: string | null;
  onOpenItemChange?: (itemId: string | null) => void;
  renderItemFocus?: (item: PhaseItem, phase: OnboardingPhaseEndpoint) => ReactNode;
  heightClassName?: string;
  /** Mark what changed since the member last looked (answered skip requests) -- the hire's view. */
  showMemberUpdates?: boolean;
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
  openItemId = null,
  onOpenItemChange,
  renderItemFocus,
  heightClassName = "h-[calc(100vh-15rem)] min-h-[32rem]",
  showMemberUpdates = false,
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

  const [divingIntoItem, setDivingIntoItem] = useState<string | null>(null);
  const entersItems = !!onOpenItemChange && !!renderItemFocus;

  const enterItem = async (itemId: string) => {
    if (!onOpenItemChange || divingIntoItem) return;
    setDivingIntoItem(itemId);
    await phaseCamera.current?.zoomIntoNode(itemId, 380);
    setDivingIntoItem(null);
    onOpenItemChange(itemId);
  };

  const leaveItem = () => {
    onOpenItemChange?.(null);
    void phaseCamera.current?.flyToFit();
  };

  // Escape steps back out of an item, unless it is being typed into.
  useEffect(() => {
    if (!openItemId || !onOpenItemChange) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Escape" || target?.closest('input, textarea, select, [role="dialog"]')) {
        return;
      }
      onOpenItemChange(null);
      void phaseCamera.current?.flyToFit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenItemChange, openItemId]);

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
    onOpenItemChange?.(null);
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
    // The same rules, and the same sentences, as the blueprint canvas: a loop, a duplicate and a
    // node pointed at itself are each said, not silently dropped.
    const refusal = edgeRefusal(
      nodes.map((node) => ({
        id: node.id,
        blockerIds: node.blockerIds ?? [],
        graphX: null,
        graphY: null,
      })),
      nodeId,
      blockerId,
    );
    if (refusal) {
      toast.warning("Those can't be connected", { description: EDGE_REFUSAL_MESSAGE[refusal] });
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
            hasUpdate={showMemberUpdates && phaseHasUnseenSkipAnswer(node.phase)}
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
  const focusedItem = entersItems ? (items.find((item) => item.id === openItemId) ?? null) : null;
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
        // The state is part of the name: the card's own text sits under this label, so a locked step
        // and one in progress would otherwise sound the same.
        nodeLabel={(item) =>
          `${item.kind === "step" ? "Step" : "Question"}: ${item.title}, ${itemStateLabel[itemState(item, openPhase.locked)]}`
        }
        fitKey={PHASE_KEY(openPhase.id)}
        focusId={nextItemId ?? selectedItemId}
        selectedId={entersItems ? null : selectedItemId}
        onSelect={(id) => {
          if (entersItems) {
            if (id) void enterItem(id);
            return;
          }
          onSelectItem(id);
        }}
        spotlightId={divingIntoItem ?? focusedItem?.id ?? null}
        // Only where there is something to open: without it Enter falls back to what a click does.
        onOpen={
          onOpenItem
            ? (id) => {
                const item = items.find((candidate) => candidate.id === id);
                if (item) onOpenItem(item);
              }
            : undefined
        }
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
            {editing ? (
              // Named and up front: as a "+" among the zoom controls it read as "zoom in".
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-app-border/70 pt-2 pl-2">
                <button
                  type="button"
                  onClick={() => addStepAt(phaseCamera.current?.viewCenter() ?? { x: 0, y: 0 })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-app-brand-hover"
                >
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                  Add step
                </button>
                <span className="text-[11px] text-app-text-subtle">
                  or double-click the canvas where it should go
                </span>
              </div>
            ) : null}
          </div>
        }
        toolbar={arrangeTools}
        heightClassName={heightClassName}
        aside={
          !entersItems && selectedItem && renderItemAside
            ? renderItemAside(selectedItem, openPhase)
            : undefined
        }
        cover={
          focusedItem && renderItemFocus ? (
            <ItemFocus
              key={focusedItem.id}
              item={focusedItem}
              phase={openPhase}
              phaseIndex={index}
              onBack={leaveItem}
              onJourneyMap={surface}
            >
              {renderItemFocus(focusedItem, openPhase)}
            </ItemFocus>
          ) : undefined
        }
        renderNode={(item, render) => (
          <ItemNodeCard
            item={item}
            state={itemState(item, openPhase.locked)}
            render={render}
            isNext={item.id === nextItemId}
            showUpdates={showMemberUpdates}
          />
        )}
      />
    </motion.div>
  );
}

/**
 * A step or question zoomed into until it is the whole graph: the camera flies into the node, and the
 * node opens up into the thing itself, with the way back out along the top.
 */
function ItemFocus({
  item,
  phase,
  phaseIndex,
  onBack,
  onJourneyMap,
  children,
}: {
  item: PhaseItem;
  phase: OnboardingPhaseEndpoint;
  phaseIndex: number;
  onBack: () => void;
  onJourneyMap: () => void;
  children: ReactNode;
}) {
  const state = itemState(item, phase.locked);
  const isQuestion = item.kind === "question";
  return (
    <div className="absolute inset-0 flex items-stretch justify-center bg-app-bg-soft/70 p-3 backdrop-blur-sm sm:p-6">
      <motion.section
        aria-label={`${isQuestion ? "Question" : "Step"}: ${item.title}`}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border bg-app-surface shadow-2xl ${
          isQuestion ? "border-app-question-border" : "border-app-brand-border"
        }`}
      >
        <header
          className={`border-b px-4 py-3 sm:px-6 ${
            isQuestion
              ? "border-app-question-border/60 bg-app-question-bg/50"
              : "border-app-border bg-app-brand-soft/30"
          }`}
        >
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
          <div className="mt-2 flex items-start gap-3">
            <ItemGlyph item={item} state={state} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-[11px] font-semibold tracking-wide uppercase ${
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
        <div className="app-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>
      </motion.section>
    </div>
  );
}
