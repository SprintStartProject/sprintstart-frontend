import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, ListPlus, Lock } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { blockingPhases, phaseProgress, phaseState, type PhaseItem } from "../../../journey";
import { JourneyCanvas, type JourneyCameraHandle } from "../../../graph/JourneyCanvas";
import { ItemNodeCard } from "../../../graph/JourneyNodeCards";
import { ITEM_NODE_SIZE } from "../../../graph/graphLayouts";
import type { GraphPoint } from "../../../graph/layout";
import { phaseStateLabel } from "../../../graph/nodeLabels";
import { itemNumbers } from "../../../itemNumbers";
import { itemState } from "../../../journey";
import type { OnboardingPhaseEndpoint } from "../../../types";
import { EdgeLegend } from "./graphKit";
import {
  MAP_EDGE_TONES,
  PHASE_KEY,
  derivePhaseView,
  itemEdgeTone,
  itemNodeLabel,
  itemOpener,
} from "./graphRules";
import type { GraphEditing, JourneyGraphProps } from "./graphTypes";
import { ItemFocus } from "./ItemFocus";

type PhaseGraphViewProps = {
  graph: JourneyGraphProps;
  phase: OnboardingPhaseEndpoint;
  cameraRef: RefObject<JourneyCameraHandle | null>;
  items: PhaseItem[];
  positions: Map<string, GraphPoint>;
  arranging: boolean;
  toolbar: ReactNode;
  divingIntoItem: string | null;
  onEnterItem: (itemId: string) => void;
  onLeaveItem: () => void;
  onSurface: () => void;
  onMove: (id: string, point: GraphPoint) => void;
  onConnect: (blockerId: string, nodeId: string) => void;
  onDisconnect: (blockerId: string, nodeId: string) => void;
  onAddStepAt: (point: GraphPoint) => void;
  onAddStepInView: () => void;
};

function AddStepRow({ onAdd }: { onAdd: () => void }) {
  // Named and up front: as a "+" among the zoom controls it read as "zoom in".
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-app-border/70 pt-2 pl-2">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-app-brand-hover"
      >
        <ListPlus className="h-4 w-4" aria-hidden="true" />
        Add step
      </button>
      <span className="text-xs text-app-text-subtle">
        or double-click the canvas where it should go
      </span>
    </div>
  );
}

type PhaseOverlayProps = {
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  editing: GraphEditing | undefined;
  onSurface: () => void;
  onAddStep: () => void;
};

function PhaseOverlay({ phase, phases, editing, onSurface, onAddStep }: PhaseOverlayProps) {
  const progress = phaseProgress(phase);
  const waitsOn = blockingPhases(phase, phases);

  return (
    <div className="max-w-[min(34rem,calc(100vw-4rem))] rounded-2xl border border-app-border/70 bg-app-surface/90 p-2 pr-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSurface}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Journey map
        </button>
        <ChevronRight className="h-4 w-4 shrink-0 text-app-text-subtle" aria-hidden="true" />
        <h3 className="min-w-0 truncate text-sm font-semibold text-app-text">
          <span className="text-app-text-subtle tabular-nums">{phases.indexOf(phase) + 1}.</span>{" "}
          {phase.title}
        </h3>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-2 text-xs text-app-text-muted">
        <span className="font-medium">{phaseStateLabel[phaseState(phase)]}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {progress.completed}/{progress.total} done
        </span>
        {waitsOn.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">·</span>
            <Lock className="h-3 w-3" aria-hidden="true" />
            Opens after {waitsOn.map((blocker) => blocker.title).join(", ")}
          </span>
        ) : null}
      </div>
      <EdgeLegend tones={MAP_EDGE_TONES} className="mt-1.5 pl-2" />
      {editing ? <AddStepRow onAdd={onAddStep} /> : null}
    </div>
  );
}

type FocusCoverProps = Pick<
  PhaseGraphViewProps,
  "graph" | "phase" | "onLeaveItem" | "onSurface"
> & {
  item: PhaseItem;
};

/** The item zoomed into until it fills the graph, drawn by the caller. */
function FocusCover({ graph, phase, item, onLeaveItem, onSurface }: FocusCoverProps) {
  return (
    <ItemFocus
      key={item.id}
      item={item}
      phase={phase}
      phaseIndex={graph.phases.indexOf(phase)}
      onBack={onLeaveItem}
      onJourneyMap={onSurface}
    >
      {graph.renderItemFocus?.(item, phase)}
    </ItemFocus>
  );
}

/** What the canvas needs to move nodes, draw connections and add a step — only for the PM's `editing`. */
function editProps(props: PhaseGraphViewProps) {
  const { editing } = props.graph;

  return {
    canMove: props.arranging,
    onMove: props.onMove,
    canConnect: !!editing && props.arranging,
    onConnect: props.onConnect,
    onDisconnect: editing ? props.onDisconnect : undefined,
    onCanvasDoubleClick: editing ? props.onAddStepAt : undefined,
  };
}

/** The item the camera is flying into, else the one opened up, else none. */
function spotlightOf(divingIntoItem: string | null, focusedItem: PhaseItem | null): string | null {
  return divingIntoItem ?? focusedItem?.id ?? null;
}

/** The selected item's details drawn over the canvas, unless clicks fly into items instead. */
function asideFor(props: PhaseGraphViewProps, selectedItem: PhaseItem | null) {
  return selectedItem ? props.graph.renderItemAside?.(selectedItem, props.phase) : undefined;
}

function coverFor(props: PhaseGraphViewProps, focusedItem: PhaseItem | null) {
  const { graph, phase } = props;
  if (!focusedItem || !graph.renderItemFocus) return undefined;

  return (
    <FocusCover
      graph={graph}
      phase={phase}
      item={focusedItem}
      onLeaveItem={props.onLeaveItem}
      onSurface={props.onSurface}
    />
  );
}

/**
 * What the canvas needs to select, open and zoom into items. Given a way to draw an item and to
 * report entering it, a click flies into the item instead of selecting it.
 */
function selectionProps(props: PhaseGraphViewProps) {
  const { graph, items } = props;
  const { selectedItemId, nextItemId = null, openItemId = null } = graph;
  const entersItems = !!graph.onOpenItemChange && !!graph.renderItemFocus;
  const { selectedItem, focusedItem } = derivePhaseView(
    items,
    selectedItemId,
    openItemId,
    entersItems,
  );

  return {
    focusId: nextItemId ?? selectedItemId,
    selectedId: entersItems ? null : selectedItemId,
    onSelect: (id: string | null) => {
      if (!entersItems) graph.onSelectItem(id);
      else if (id) props.onEnterItem(id);
    },
    spotlightId: spotlightOf(props.divingIntoItem, focusedItem),
    onOpen: itemOpener(items, graph.onOpenItem),
    aside: asideFor(props, entersItems ? null : selectedItem),
    cover: coverFor(props, focusedItem),
  };
}

/** The graph of one phase's steps and questions, with the way back to the map above it. */
export function PhaseGraphView(props: PhaseGraphViewProps) {
  const { graph, phase } = props;
  const { editing, nextItemId = null } = graph;
  // The numbers the list and the buddy use for these items, so a node can be named by the one on it.
  const numbers = itemNumbers(phase);

  return (
    <motion.div
      key={phase.id}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <JourneyCanvas
        key={phase.id}
        cameraRef={props.cameraRef}
        nodes={props.items}
        positions={props.positions}
        nodeSize={ITEM_NODE_SIZE}
        ariaLabel={`Graph of the steps and questions in ${phase.title}`}
        nodeLabel={(item) => itemNodeLabel(item, phase.locked)}
        fitKey={PHASE_KEY(phase.id)}
        edgeTone={(blocker, node) => itemEdgeTone(blocker, node, phase.locked)}
        {...editProps(props)}
        {...selectionProps(props)}
        overlay={
          <PhaseOverlay
            phase={phase}
            phases={graph.phases}
            editing={editing}
            onSurface={props.onSurface}
            onAddStep={props.onAddStepInView}
          />
        }
        toolbar={props.toolbar}
        heightClassName={graph.heightClassName ?? ""}
        renderNode={(item, render) => (
          <ItemNodeCard
            item={item}
            state={itemState(item, phase.locked)}
            render={render}
            isNext={item.id === nextItemId}
            showUpdates={graph.showMemberUpdates ?? false}
            number={numbers.get(item.id)}
          />
        )}
      />
    </motion.div>
  );
}
