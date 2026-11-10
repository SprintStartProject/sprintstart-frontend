import { useMemo, useRef, useState } from "react";
import { SWIPE_IGNORE_ATTRIBUTE } from "../../../hooks/useHorizontalWheelNavigation.ts";
import {
  type GraphPoint,
  type JourneyCameraHandle,
  JourneyCanvas,
  type JourneyEdgeTone,
} from "../graphKit.ts";
import { useChainFocus, type ChainHalf } from "../hooks/useChainFocus.ts";
import { useGraphEdits, useGraphSaving } from "../hooks/useGraphEdits.ts";
import { useGraphKeyboard } from "../hooks/useGraphKeyboard.ts";
import { useGraphPositions, NODE_SIZE } from "../hooks/useGraphPositions.ts";
import { useNodeDetail } from "../hooks/useNodeDetail.ts";
import { useTidyUp } from "../hooks/useTidyUp.ts";
import {
  CanvasHeader,
  CanvasToolbar,
  EmptyNotice,
  NodeFrame,
  NodeSearch,
  RunSummary,
  SaveStatus,
  TidyProposal,
} from "./BlueprintCanvasParts.tsx";
import { GraphLegend } from "./GraphLegend.tsx";
import { NodeCover } from "./BlueprintNodeCover.tsx";
import type { BlueprintGraphCanvasNode, Props } from "./blueprintGraphCanvasTypes.ts";

export type {
  BlueprintGraphCanvasNode,
  BlueprintGraphCanvasNodeProps,
  JourneyEdgeTone,
} from "./blueprintGraphCanvasTypes.ts";

/**
 * The canvas's edge style for each half: a solid orange line behind, the brand line ahead.
 *
 * No entry for the node itself — an arrow has two ends, and which half it belongs to is decided by
 * both of them, never by one.
 */
const HALF_EDGE: Record<Exclude<ChainHalf, "focus">, JourneyEdgeTone> = {
  behind: "upstream",
  ahead: "active",
};

/**
 * Reusable canvas for arranging Blueprint nodes and the prerequisites between them.
 *
 * The same canvas the onboarding journey is drawn on — {@link JourneyCanvas} — rather than a second
 * one built on React Flow. There is no second idea of what a graph in this product looks like: one
 * set of gestures, one toolbar, one minimap, one full-screen, one way an arrow is drawn. The
 * Blueprint editor and the hire's journey are the same picture at two moments in its life, and a
 * PM who has learned one has learned the other.
 *
 * What is Blueprint-specific sits on top of that canvas rather than inside it: the search, the
 * legend, the run summary, the entry-point marks, the proposed arrangement, and the buttons that
 * make nodes.
 *
 * **What an edge means, and what it does not.** An arrow from A to B says B cannot start until A is
 * finished — a hard lock. Nodes with no arrow between them are not ordered at all; the reader is
 * free to take them in any order. The legend on the canvas says exactly this, because a graph whose
 * one relation is unexplained gets read as a suggested route, which is the opposite of what it is.
 *
 * **Coordinates are centres, not corners.** That is how they were stored before this canvas existed
 * and how the backend seed writes them, and the journey canvas places nodes by their centre too —
 * so they pass straight through rather than being reinterpreted.
 */
export function BlueprintGraphCanvas<TNode extends BlueprintGraphCanvasNode>({
  nodes,
  title,
  description,
  headerAction,
  editable,
  height = "page",
  ariaLabel = "Blueprint graph canvas",
  emptyTitle = "Nothing on the canvas yet",
  onNodeClick,
  onPositionChange,
  onAddBlocker,
  onRemoveBlocker,
  createKinds = [],
  onCreateNode,
  renderNode,
  renderNodeDetail,
  openNodeId = null,
  onCloseNodeDetail,
  onNavigateNodeDetail,
  edgeTone,
}: Props<TNode>) {
  const camera = useRef<JourneyCameraHandle>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  /**
   * Hides everything outside the lit run instead of dimming it.
   *
   * Dimming answers "which of these matter" on a graph somebody can see all of. On forty nodes it
   * leaves forty ghosts, and the run being looked at is still buried in them.
   */
  const [chainOnly, setChainOnly] = useState(false);

  /**
   * The furniture a canvas carries is furniture for a canvas somebody works in.
   *
   * In a strip a few hundred pixels tall, a search field and a legend panel cover the thing they are
   * meant to help with. What is left there is the graph, its zoom bar and its full-screen button --
   * which is exactly what makes a strip worth having.
   */
  const isEmbedded = height === "fill";
  const [isLegendOpen, setIsLegendOpen] = useState(!isEmbedded);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const layout = useGraphPositions(nodes);
  const { positions, entryPoints, chainPositionById } = layout;
  const chain = useChainFocus(nodes, nodeById);
  const { focus, chainIds } = chain;
  const { isSaving, saveError, setSaveError, runMutation } = useGraphSaving();
  const edits = useGraphEdits({
    nodes,
    nodeById,
    runMutation,
    setSaveError,
    preview: layout.preview,
    setPreview: layout.setPreview,
    setOverrides: layout.setOverrides,
    onPositionChange,
    onAddBlocker,
    onRemoveBlocker,
    onCreateNode,
  });
  const tidy = useTidyUp({ nodes, positions: layout, runMutation, onPositionChange });
  const handleKeyDown = useGraphKeyboard({
    nodes,
    positions,
    entryPoints,
    selectedId: chain.selectedId,
    setSelectedId: chain.setSelectedId,
    camera,
  });
  const nodeDetail = useNodeDetail({
    nodes,
    nodeById,
    camera,
    openNodeId,
    renderNodeDetail,
    onNodeClick,
    onCloseNodeDetail,
    onNavigateNodeDetail,
  });
  const { detail, openNode, neighbours, goToNeighbour, swipeRef, flyingInto, openNodeById } =
    nodeDetail;

  /**
   * The nodes whose titles match what was typed, or null when nothing was.
   *
   * Matching rather than filtering: a node that matches is lit and the rest go quiet, so the *shape*
   * of the graph stays on screen. Removing the others would answer "where is the one about
   * deployment" by throwing away the thing that says where it sits.
   */
  const matchIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return null;
    return new Set(
      nodes.filter((node) => node.title.toLowerCase().includes(needle)).map((node) => node.id),
    );
  }, [nodes, query]);

  const drawnNodes = useMemo(
    () => (chainOnly && chainIds !== null ? nodes.filter((node) => chainIds.has(node.id)) : nodes),
    [chainIds, chainOnly, nodes],
  );
  const drawnPositions = useMemo(() => {
    if (drawnNodes.length === nodes.length) return positions;
    return new Map(drawnNodes.map((node) => [node.id, positions.get(node.id)!]));
  }, [drawnNodes, nodes.length, positions]);

  const canAuthor = editable && !isSaving;
  const focusTitle = focus ? nodeById.get(focus.id)?.title : undefined;

  return (
    <section
      className={
        isEmbedded
          ? // No border and no surface of its own: something that fits a box it was handed is
            // something whose container has already decided what it sits in.
            "flex h-full flex-col overflow-hidden"
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm"
      }
    >
      <CanvasHeader title={title} description={description} headerAction={headerAction} />

      <div
        className={`relative flex min-h-0 ${
          isEmbedded ? "flex-1" : "h-[clamp(38rem,calc(100vh-14rem),76rem)]"
        }`}
      >
        {/*
          eslint-disable-next-line jsx-a11y/no-static-element-interactions --
          Not itself a widget: the widget is the canvas inside, which declares `role="application"`
          and holds the focus. This only catches the arrow keys on their way out of it, because
          which node is "left" of this one is a question about the graph rather than about the DOM
          order the nodes happen to be in.
        */}
        <div
          ref={paneRef}
          className="relative min-w-0 flex-1"
          data-testid="blueprint-graph-canvas"
          // A two-finger horizontal swipe here pans the graph. Without this it would also switch
          // the tab the graph is on, which is the one thing nobody panning a graph wants.
          {...{ [SWIPE_IGNORE_ATTRIBUTE]: "" }}
          onKeyDown={handleKeyDown}
        >
          <JourneyCanvas<TNode>
            cameraRef={camera}
            nodes={drawnNodes}
            positions={drawnPositions}
            nodeSize={NODE_SIZE}
            ariaLabel={ariaLabel}
            heightClassName="h-full"
            // The nodes themselves, not how many there are. Opening a draft replaces every id while
            // leaving the count alone, and a count-only key told the canvas nothing had changed —
            // so it kept the view it had framed around the version before, which is how landing on
            // a draft looked like being dropped in zoomed on one card.
            fitKey={`${layout.fitSubject}|${layout.arrangement}|${chainOnly ? "chain" : "all"}`}
            // Everything, every time the graph is opened. The canvas can also open on one node at a
            // readable zoom when the whole thing would be too small, and for a hire working through
            // their own path that is the right answer — but an author switching to the graph is
            // asking what the blueprint *is*, and being dropped into a corner of it answers a
            // question they did not ask. The card's own far form is what keeps that readable.
            focusId={null}
            // Selection is kept here rather than handed to the canvas, which would otherwise treat
            // a click on the node it already has selected as a request to deselect it. That is
            // right where a click *is* the selection, and wrong here where a click opens the node:
            // closing a node left it selected, so opening it again took two clicks, the first of
            // which appeared to do nothing. What the canvas would have drawn from it — the lit run
            // and the dimming around it — is drawn below from the same `focus` that already decides
            // the arrow colours, so nothing is lost by holding it in one place.
            selectedId={null}
            // Absent where nothing can be opened or arranged, which is what makes the nodes
            // ordinary pictures rather than controls (see `onNodeClick`).
            onSelect={
              onNodeClick || renderNodeDetail || editable
                ? (id) => {
                    if (id === null) {
                      chain.setSelectedId(null);
                      return;
                    }
                    chain.setSelectedId(id);
                    openNodeById(id);
                  }
                : undefined
            }
            spotlightId={flyingInto}
            cover={
              detail && openNode ? (
                <NodeCover
                  title={detail.title ?? openNode.title}
                  context={title}
                  footer={detail.footer}
                  onBack={() => onCloseNodeDetail?.()}
                  surfaceRef={swipeRef}
                  previous={onNavigateNodeDetail ? neighbours.previous : null}
                  next={onNavigateNodeDetail ? neighbours.next : null}
                  onGo={goToNeighbour}
                >
                  {detail.body}
                </NodeCover>
              ) : undefined
            }
            edgeTone={(blocker, node) => {
              // While a node is being pointed at, which half of its run an arrow is in outranks
              // where the arrow came from: the first is the question being asked right now, and
              // the second is on the card and in the legend either way.
              const half = chain.halfOfEdge(blocker.id, node.id);
              if (half) return HALF_EDGE[half];
              return edgeTone?.(node, blocker.id) ?? "rule";
            }}
            // Not while a save is in flight: a second drag of the same card would send the revision
            // the first one is about to replace, and come back as a conflict.
            canMove={editable && !isSaving}
            onMove={edits.handleMove}
            // Not while a save is in flight, for the same reason moves are not: two quick drags
            // off the same node would send the same revision twice.
            canConnect={canAuthor}
            onConnect={edits.handleConnect}
            onDisconnect={editable ? edits.handleDisconnect : undefined}
            onCanvasDoubleClick={
              canAuthor && createKinds[0]
                ? // The first kind, on a surface that has more than one: the toolbar names them
                  // all, and a double-click cannot ask which.
                  (point) => edits.createAt(createKinds[0].id, point)
                : undefined
            }
            nodeLabel={(node) =>
              [
                node.title,
                entryPoints.has(node.id) ? "nothing has to happen first" : null,
                node.blockerIds.length > 0
                  ? `waits for ${node.blockerIds
                      .map((blockerId) => nodeById.get(blockerId)?.title)
                      .filter(Boolean)
                      .join(", ")}`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")
            }
            renderNode={(node, state) => (
              <NodeFrame
                id={node.id}
                half={chain.halfOfNode(node.id)}
                // Two reasons a node goes quiet, and they stack: it is outside the run being looked
                // at, or it does not match what was typed.
                dimmed={
                  (chainIds !== null && !chainIds.has(node.id)) ||
                  (matchIds !== null && !matchIds.has(node.id))
                }
                selected={node.id === chain.selectedId}
                isEntry={entryPoints.has(node.id)}
                onEnter={() => chain.setHoveredId(node.id)}
                onLeave={() =>
                  chain.setHoveredId((current) => (current === node.id ? null : current))
                }
              >
                {renderNode(node, {
                  disabled: isSaving,
                  zoom: state.zoom,
                  highlighted: node.id === chain.focusId,
                  chainPosition: chainPositionById.get(node.id),
                })}
              </NodeFrame>
            )}
            overlay={
              <div className="flex flex-col items-start gap-2">
                {nodes.length > 4 && !isEmbedded ? (
                  <NodeSearch value={query} onChange={setQuery} />
                ) : null}
                {focus ? (
                  <RunSummary
                    title={focusTitle}
                    behind={focus.behind.size}
                    ahead={focus.ahead.size}
                  />
                ) : null}
              </div>
            }
            aside={
              layout.preview ? (
                <TidyProposal
                  onAccept={tidy.handleAcceptPreview}
                  onDiscard={tidy.handleDiscardPreview}
                />
              ) : isLegendOpen && !isEmbedded ? (
                <GraphLegend editable={editable} onClose={() => setIsLegendOpen(false)} />
              ) : undefined
            }
            toolbar={
              <CanvasToolbar
                canAuthor={canAuthor}
                createKinds={createKinds}
                hasCreate={!!onCreateNode}
                onCreate={(kindId) => edits.createAt(kindId, camera.current?.viewCenter() ?? zero)}
                isEmbedded={isEmbedded}
                chainOnly={chainOnly}
                hasRun={chainIds !== null}
                onToggleChainOnly={() => setChainOnly((only) => !only)}
                isLegendOpen={isLegendOpen}
                onToggleLegend={() => setIsLegendOpen((open) => !open)}
                onTidyUp={tidy.handleTidyUp}
              />
            }
          />

          {nodes.length === 0 ? (
            <EmptyNotice title={emptyTitle} canMake={canAuthor && createKinds.length > 0} />
          ) : null}

          <SaveStatus isSaving={isSaving} saveError={saveError} />
        </div>
      </div>
    </section>
  );
}

const zero: GraphPoint = { x: 0, y: 0 };
