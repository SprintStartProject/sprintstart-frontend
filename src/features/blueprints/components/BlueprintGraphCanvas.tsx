import { useMemo, useRef, useState } from "react";
import { Flag, Info, LayoutGrid, Plus, Search, TriangleAlert, Waypoints } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";
import { SWIPE_IGNORE_ATTRIBUTE } from "../../../hooks/useHorizontalWheelNavigation.ts";
import {
  CanvasButton,
  JourneyCanvas,
  type JourneyCameraHandle,
  type JourneyEdgeTone,
} from "../../onboarding/graph/JourneyCanvas.tsx";
import type { GraphPoint } from "../../onboarding/graph/layout.ts";
import { useChainFocus, type ChainHalf } from "../hooks/useChainFocus.ts";
import { useGraphEdits, useGraphSaving } from "../hooks/useGraphEdits.ts";
import { useGraphKeyboard } from "../hooks/useGraphKeyboard.ts";
import { useGraphPositions, NODE_SIZE } from "../hooks/useGraphPositions.ts";
import { useNodeDetail } from "../hooks/useNodeDetail.ts";
import { useTidyUp } from "../hooks/useTidyUp.ts";
import { GraphLegend } from "./GraphLegend.tsx";
import { NodeCover } from "./BlueprintNodeCover.tsx";
import type { BlueprintGraphCanvasNode, Props } from "./blueprintGraphCanvasTypes.ts";

export type {
  BlueprintGraphCanvasNode,
  BlueprintGraphCanvasNodeProps,
  JourneyEdgeTone,
} from "./blueprintGraphCanvasTypes.ts";

/** What each half wears. Orange is what has to come first; the brand colour is what comes after. */
const HALF_RING: Record<ChainHalf, string> = {
  focus: "ring-2 ring-app-brand ring-offset-2 ring-offset-app-bg-soft",
  behind: "ring-2 ring-app-orange-text ring-offset-2 ring-offset-app-bg-soft",
  ahead: "ring-2 ring-app-brand/60 ring-offset-2 ring-offset-app-bg-soft",
};

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
      {/*
        Only where there is something to head. A canvas embedded in something that has already
        named it — a strip on a board, a panel about one card — was drawing an empty `h2` and an
        empty paragraph above itself: sixty pixels of nothing in a two-hundred-pixel strip, and a
        heading with no text in it, which is a heading a screen reader announces and cannot read.
      */}
      {title || headerAction ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-app-text">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-app-text-muted">{description}</p> : null}
          </div>
          {headerAction ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{headerAction}</div>
          ) : null}
        </div>
      ) : null}

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
            renderNode={(node, state) => {
              // Two reasons a node goes quiet, and they stack: it is outside the run being looked
              // at, or it does not match what was typed.
              const dimmed =
                (chainIds !== null && !chainIds.has(node.id)) ||
                (matchIds !== null && !matchIds.has(node.id));
              const half = chain.halfOfNode(node.id);
              return (
                <div
                  data-testid={`graph-node-${node.id}`}
                  // Which half of the lit run this card is in, as an attribute as well as a
                  // colour: the colour is the answer for a reader, and this is the one thing a
                  // test can hold on to without asserting a class name.
                  data-chain-half={half ?? undefined}
                  onMouseEnter={() => chain.setHoveredId(node.id)}
                  onMouseLeave={() =>
                    chain.setHoveredId((current) => (current === node.id ? null : current))
                  }
                  className={`relative h-full w-full rounded-xl transition-opacity duration-200 ${
                    dimmed ? "opacity-35" : "opacity-100"
                  } ${
                    half
                      ? HALF_RING[half]
                      : node.id === chain.selectedId
                        ? "ring-2 ring-app-brand-border-strong"
                        : ""
                  }`}
                >
                  {renderNode(node, {
                    disabled: isSaving,
                    zoom: state.zoom,
                    highlighted: node.id === chain.focusId,
                    chainPosition: chainPositionById.get(node.id),
                  })}

                  {entryPoints.has(node.id) ? (
                    <span className="pointer-events-none absolute -top-2.5 left-3 z-10">
                      <Badge variant="brand" size="sm" className="gap-1 shadow-sm">
                        <Flag className="h-3 w-3" aria-hidden="true" /> Start
                      </Badge>
                    </span>
                  ) : null}
                </div>
              );
            }}
            overlay={
              <div className="flex flex-col items-start gap-2">
                {/*
                  The search sits on the canvas rather than in the header: what it does happens
                  here, and a control whose effect is three inches away from it reads as a page
                  filter rather than as a way of looking at this graph.
                */}
                {nodes.length > 4 && !isEmbedded ? (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-app-text-subtle"
                      aria-hidden="true"
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a node"
                      aria-label="Find a node on the canvas"
                      className="h-8 w-44 rounded-lg border border-app-border bg-app-surface/95 pr-2 pl-8 text-xs text-app-text shadow-sm backdrop-blur placeholder:text-app-text-subtle"
                    />
                  </div>
                ) : null}

                {focus ? (
                  // What pointing at a node actually told you, in words. The picture says which
                  // nodes are in the run; this says how much of it there is — the number nobody
                  // can count off a picture, and the one that decides whether a node is worth
                  // doing early. "Opens 4" is the difference between a node in the way and a node
                  // in a corner.
                  <div className="max-w-56 rounded-xl border border-app-border bg-app-surface/95 px-3 py-2 shadow-md backdrop-blur">
                    <p className="truncate text-xs font-semibold text-app-text">{focusTitle}</p>
                    <p className="mt-1 flex flex-col gap-1 text-xs text-app-text-muted">
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-0.5 w-3 shrink-0 rounded-full bg-app-orange-text"
                        />
                        {focus.behind.size === 0
                          ? "Nothing has to happen first"
                          : `${focus.behind.size} must happen first`}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-0.5 w-3 shrink-0 rounded-full bg-app-brand"
                        />
                        {focus.ahead.size === 0
                          ? "Nothing waits on this"
                          : `Finishing it opens ${focus.ahead.size}`}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            }
            aside={
              layout.preview ? (
                // The proposal states what it did and what happens next, because "Tidy up" has
                // already redrawn the canvas by the time this is read: without the sentence, an
                // author cannot tell an applied change from an offered one.
                <div className="flex flex-col gap-2 rounded-2xl border border-app-brand-border bg-app-surface p-3 shadow-app-brand-lift">
                  <p className="text-sm font-semibold text-app-text">Laid out by prerequisite</p>
                  <p className="text-xs text-app-text-muted">
                    Nothing is saved yet. Drag any card to adjust it first, or put the old
                    layout.arrangement back.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={tidy.handleAcceptPreview}>
                      Keep this
                    </Button>
                    <Button variant="secondary" size="sm" onClick={tidy.handleDiscardPreview}>
                      Put it back
                    </Button>
                  </div>
                </div>
              ) : isLegendOpen && !isEmbedded ? (
                <GraphLegend editable={editable} onClose={() => setIsLegendOpen(false)} />
              ) : undefined
            }
            toolbar={
              <>
                {canAuthor && onCreateNode
                  ? createKinds.map((kind) => (
                      <CanvasButton
                        key={kind.id}
                        label={kind.label}
                        onClick={() =>
                          edits.createAt(kind.id, camera.current?.viewCenter() ?? zero)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </CanvasButton>
                    ))
                  : null}
                {isEmbedded ? null : (
                  <CanvasButton
                    label={chainOnly ? "Show the whole graph again" : "Show only the selected run"}
                    active={chainOnly}
                    disabled={chainIds === null}
                    onClick={() => setChainOnly((only) => !only)}
                  >
                    <Waypoints className="h-4 w-4" />
                  </CanvasButton>
                )}
                {isEmbedded ? null : (
                  <CanvasButton
                    label={isLegendOpen ? "Hide the legend" : "What the symbols mean"}
                    active={isLegendOpen}
                    onClick={() => setIsLegendOpen((open) => !open)}
                  >
                    <Info className="h-4 w-4" />
                  </CanvasButton>
                )}
                {canAuthor ? (
                  <CanvasButton label="Tidy up" onClick={tidy.handleTidyUp}>
                    <LayoutGrid className="h-4 w-4" />
                  </CanvasButton>
                ) : null}
              </>
            }
          />

          {/*
            An empty canvas is indistinguishable from one that failed to load, and a first-time
            author has no way to guess what makes a node. This says both — and it does not
            intercept the pointer, so a double-click through it still makes one.
          */}
          {nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-dashed border-app-border bg-app-surface/90 px-6 py-5 text-center">
                <Waypoints className="mx-auto h-8 w-8 text-app-text-disabled" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-app-text">{emptyTitle}</p>
                <p className="mt-1 text-sm text-app-text-muted">
                  {canAuthor && createKinds.length > 0
                    ? "Double-click anywhere here to make one, or use the button below."
                    : "Nothing has been placed here yet."}
                </p>
              </div>
            </div>
          ) : null}

          {isSaving ? (
            <p className="absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-app-surface px-3 py-2 text-xs text-app-text-muted shadow-lg">
              <Spinner size="sm" silent /> Saving graph…
            </p>
          ) : null}
          {saveError ? (
            <p
              role="alert"
              className="absolute bottom-4 left-4 z-40 flex max-w-sm items-start gap-1.5 rounded-lg bg-app-danger-bg px-3 py-2 text-xs text-app-danger-text shadow-lg"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {saveError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const zero: GraphPoint = { x: 0, y: 0 };
