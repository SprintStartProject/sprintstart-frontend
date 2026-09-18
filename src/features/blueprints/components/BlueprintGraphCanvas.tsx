import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  Info,
  KeyRound,
  LayoutGrid,
  Plus,
  Search,
  Waypoints,
  X,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";
import {
  SWIPE_IGNORE_ATTRIBUTE,
  useHorizontalWheelNavigation,
} from "../../../hooks/useHorizontalWheelNavigation.ts";
import { LOCK_SENTENCE } from "../../graph-diagram/lockWords.ts";
import {
  CanvasButton,
  JourneyCanvas,
  type JourneyCameraHandle,
  type JourneyEdgeTone,
} from "../../onboarding/graph/JourneyCanvas.tsx";
import {
  layeredLayout,
  resolveLayout,
  type GraphPoint,
  type LayoutOptions,
} from "../../onboarding/graph/layout.ts";
import {
  EDGE_REFUSAL_MESSAGE,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  blockersBehind,
  chainPositions,
  dependentsAhead,
  edgeRefusal,
  entryPointIds,
  keyboardNeighbour,
  type ChainPosition,
  type GraphDirection,
  type GraphPositions,
} from "../../graph-diagram/graphLayout.ts";

export type { JourneyEdgeTone };

/** The common graph fields persisted for both Blueprint phases and phase-subgraph nodes. */
export type BlueprintGraphCanvasNode = {
  id: string;
  title: string;
  graphX: number | null;
  graphY: number | null;
  blockerIds: string[];
};

/** What a domain-specific node card is told about the state it is drawn in. */
export type BlueprintGraphCanvasNodeProps = {
  /** True while a graph mutation is in flight; the card should not invite another click. */
  disabled: boolean;
  /**
   * The canvas's current zoom, so a card can size a label against it.
   *
   * Everything on the canvas shrinks with the zoom, which is right for the picture and wrong for
   * the words in it: at the zoom where the seeded blueprint's sixteen phases fit, 13px type is
   * four pixels on screen. A card that divides by this stays a label rather than becoming a smear.
   */
  zoom: number;
  /**
   * True when this is the node the reader is pointing at, whose run is lit.
   *
   * The card that started a highlight has to be findable again: on a graph where half the nodes are
   * lit, "which one did I point at" is a question the lighting cannot answer by itself.
   */
  highlighted?: boolean;
  /**
   * Where this node sits in the chain it belongs to, or `undefined` when it belongs to none.
   *
   * Absent is the common case and it means something: this node is in no particular order relative
   * to anything else, and the card says so rather than leaving the reader to guess.
   */
  chainPosition?: ChainPosition;
};

type Props<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  title: string;
  description: string;
  headerAction?: ReactNode;
  editable: boolean;
  /**
   * How tall the canvas makes itself.
   *
   * `"page"` is a surface that owns its share of the screen: it takes most of the viewport height
   * and never less than about 34rem, which is what an editor wants. `"fill"` takes exactly the box
   * it is given, which is what anything embedded wants — a strip on a board, a panel about one
   * card. Getting this wrong is not a cosmetic error: a `"page"` canvas inside a 10rem box does not
   * shrink, it overflows, and paints itself over everything under it.
   */
  height?: "page" | "fill";
  ariaLabel?: string;
  /** Headline for the overlay drawn when nothing is placed. */
  emptyTitle?: string;
  onNodeClick: (node: TNode) => void;
  onPositionChange: (node: TNode, x: number, y: number) => Promise<void>;
  onAddBlocker: (node: TNode, blockerId: string) => Promise<void>;
  onRemoveBlocker: (node: TNode, blockerId: string) => Promise<void>;
  /**
   * What this canvas can make, and what each one is called on the button that makes it.
   *
   * A path graph has one kind of node; a phase's sub-graph has two. Empty on a canvas that only
   * shows what is already there.
   */
  createKinds?: { id: string; label: string }[];
  /** Makes one, at a point on the canvas. */
  onCreateNode?: (kindId: string, x: number, y: number) => Promise<void>;
  renderNode: (node: TNode, props: BlueprintGraphCanvasNodeProps) => ReactNode;
  /**
   * A node opened up into the canvas itself, instead of into a panel beside it.
   *
   * Clicking a node then flies the camera into it until it fills the graph, and the node becomes
   * the page — the same move the journey makes when a hire opens a step. A panel beside the canvas
   * put the thing being edited next to a picture of itself, with the picture two thirds of a screen
   * wide and nobody reading it; flying in spends that room on the editing and keeps the graph as
   * the place all of it happens.
   *
   * Left out on a surface with nothing to open, which falls back to `onNodeClick` alone.
   */
  renderNodeDetail?: (node: TNode) => {
    /** Headline of the opened node. Defaults to the node's own title. */
    title?: string;
    body: ReactNode;
    /** The row along the bottom: whether it is saved, and the destructive way out. */
    footer?: ReactNode;
  };
  /**
   * Which node is open, and how to shut it.
   *
   * Held by the caller rather than here, because closing is not always allowed: an editor with
   * unsaved fields has to ask first, and a canvas that had already closed would be asking about
   * something the author can no longer see. Opening goes through `onNodeClick`, which is also
   * where the caller loads the node into whatever it draws.
   */
  openNodeId?: string | null;
  onCloseNodeDetail?: () => void;
  /**
   * Moves the opened node to one of its neighbours, without going back out to the graph first.
   *
   * Given this, the opened page grows a way forward and a way back — and a two-finger swipe does
   * the same thing. Reading a blueprint is walking a chain, and having to close a phase, find the
   * next one on the canvas and open it is three gestures for the one step that was meant.
   *
   * The caller does the moving rather than this canvas, because a node with unsaved fields may
   * not be left silently — which is the same reason {@link Props.openNodeId} is theirs to hold.
   */
  onNavigateNodeDetail?: (id: string) => void;
  /**
   * How firm or how far along this arrow is, where that is a question the graph can answer.
   *
   * Left out by every Blueprint surface, which draws every arrow as the rule it is: a solid line,
   * because a blueprint is a template and nothing on one has been satisfied by anybody. The dashed
   * "still waiting" style it used before was both a claim it could not make and the faintest thing
   * on the canvas — and a dash that happens to end in a gap leaves the arrowhead floating a few
   * pixels clear of its own line.
   *
   * The board's two surfaces do have something to say — one about who set the arrow (see
   * {@link EDGE_TONE_STYLE}), one about whether it is satisfied — and both say it in the canvas's
   * own styles rather than in a vocabulary of their own.
   */
  edgeTone?: (node: TNode, blockerId: string) => JourneyEdgeTone;
};

/** The box a Blueprint card is drawn in, and the box the layout reserves for it. */
const NODE_SIZE = { width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT };

/**
 * How far apart the automatic layout puts them.
 *
 * Wider than the card and half again as tall, for the same reason the journey graph's numbers are:
 * the gap is where the arrows go, and an arrow that has to squeeze between two cards is an arrow
 * that reads as touching both.
 */
const BLUEPRINT_LAYOUT: LayoutOptions = { columnGap: 300, rowGap: 190, maxPerRow: 4 };

/**
 * Which half of the lit run something is in: what has to happen before the node being pointed at,
 * or what that node opens up.
 *
 * The two are the whole question somebody asks by pointing at a node, and an arrowhead answers it
 * only if you follow the arrow. Two colours answer it at a glance, which is what a graph is for —
 * so the halves are drawn apart rather than lit as one undifferentiated blob.
 */
type ChainHalf = "focus" | "behind" | "ahead";

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * The node under the pointer, which lights its run without committing to it.
   *
   * Selection stays for the node somebody is working on; hover is for the far more common act of
   * sweeping across a graph asking "what is this one tangled up with". Making that cost a click
   * meant that on a sixteen-phase graph nobody ever asked.
   */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /**
   * Hides everything outside the lit run instead of dimming it.
   *
   * Dimming answers "which of these matter" on a graph somebody can see all of. On forty nodes it
   * leaves forty ghosts, and the run being looked at is still buried in them.
   */
  const [chainOnly, setChainOnly] = useState(false);
  /** The node the camera is on its way into. Everything else fades while it travels. */
  const [flyingInto, setFlyingInto] = useState<string | null>(null);

  /**
   * The furniture a canvas carries is furniture for a canvas somebody works in.
   *
   * In a strip a few hundred pixels tall, a search field and a legend panel cover the thing they
   * are meant to help with. What is left there is the graph, its zoom bar and its full-screen
   * button — which is exactly what makes a strip worth having.
   */
  const isEmbedded = height === "fill";
  const [isLegendOpen, setIsLegendOpen] = useState(!isEmbedded);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  // ── Where the cards go ─────────────────────────────────────

  /**
   * Stored positions when every node has one, and a layered layout otherwise.
   *
   * All or nothing, and the same rule the journey graph follows: mixing stored coordinates with
   * computed ones puts two coordinate systems on one canvas, and a computed row at the origin lands
   * straight on top of the hand-placed cards. A stored layout whose cards would overlap at this
   * card size is laid out again as well — the seeded blueprint's coordinates are one.
   */
  const layout = useMemo(() => resolveLayout(nodes, BLUEPRINT_LAYOUT, NODE_SIZE), [nodes]);

  /** Moves shown before the server has them; dropped when fresh nodes arrive. */
  const [overrides, setOverrides] = useState<Record<string, GraphPoint>>({});
  const [lastNodes, setLastNodes] = useState(nodes);
  if (lastNodes !== nodes) {
    setLastNodes(nodes);
    setOverrides({});
  }

  /**
   * A proposed arrangement, held on the canvas and not yet saved.
   *
   * "Tidy up" moves every card at once and is the only thing in this editor with no way back, so
   * it shows its result and asks. Until it is accepted, this is what the canvas draws and what a
   * drag edits — so an author can lay the graph out, nudge two cards, and still throw all of it
   * away.
   */
  const [preview, setPreview] = useState<Record<string, GraphPoint> | null>(null);
  /** Bumped whenever every card has moved, so the view is framed around the new arrangement. */
  const [arrangement, setArrangement] = useState(0);

  /** What the view is framed around: a different set of nodes is a different picture. */
  const fitSubject = useMemo(() => nodes.map((node) => node.id).join(","), [nodes]);

  const positions = useMemo(() => {
    const merged = new Map(layout.positions);
    Object.entries(preview ?? overrides).forEach(([id, point]) => merged.set(id, point));
    return merged;
  }, [layout, overrides, preview]);

  // ── What is lit, and what is quiet ─────────────────────────

  const entryPoints = useMemo(() => entryPointIds(nodes), [nodes]);
  const chainPositionById = useMemo(() => chainPositions(nodes), [nodes]);

  /**
   * The nodes whose titles match what was typed, or null when nothing was.
   *
   * Matching rather than filtering: a node that matches is lit and the rest go quiet, so the
   * *shape* of the graph stays on screen. Removing the others would answer "where is the one about
   * deployment" by throwing away the thing that says where it sits.
   */
  const matchIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return null;
    return new Set(
      nodes.filter((node) => node.title.toLowerCase().includes(needle)).map((node) => node.id),
    );
  }, [nodes, query]);

  /**
   * The run being lit, split into the half in front and the half behind.
   *
   * Hover wins over selection: the pointer is the more recent statement of interest, and a
   * selection that refused to give way while somebody swept the graph would be the graph arguing.
   */
  const focusId = hoveredId ?? selectedId;
  const focus = useMemo(() => {
    if (!focusId || !nodeById.has(focusId)) return null;
    return {
      id: focusId,
      behind: blockersBehind(nodes, focusId),
      ahead: dependentsAhead(nodes, focusId),
    };
  }, [nodeById, nodes, focusId]);

  const chainIds = useMemo(
    () => (focus ? new Set([focus.id, ...focus.behind, ...focus.ahead]) : null),
    [focus],
  );

  /** Which half of the lit run a node is in, or null when nothing is lit or it is outside it. */
  const halfOfNode = useCallback(
    (id: string): ChainHalf | null => {
      if (!focus) return null;
      if (id === focus.id) return "focus";
      if (focus.behind.has(id)) return "behind";
      if (focus.ahead.has(id)) return "ahead";
      return null;
    },
    [focus],
  );

  /**
   * Which half an arrow is in.
   *
   * Both ends have to be in the same half. An arrow from something behind the focus to something
   * unrelated is not one of the reasons the focus is shut, and colouring it as though it were
   * would make the run look bigger than it is.
   */
  const halfOfEdge = useCallback(
    (blockerId: string, nodeId: string): Exclude<ChainHalf, "focus"> | null => {
      if (!focus) return null;
      const behind = (id: string) => id === focus.id || focus.behind.has(id);
      const ahead = (id: string) => id === focus.id || focus.ahead.has(id);
      if (behind(blockerId) && behind(nodeId)) return "behind";
      if (ahead(blockerId) && ahead(nodeId)) return "ahead";
      return null;
    },
    [focus],
  );

  const drawnNodes = useMemo(
    () => (chainOnly && chainIds !== null ? nodes.filter((node) => chainIds.has(node.id)) : nodes),
    [chainIds, chainOnly, nodes],
  );
  const drawnPositions = useMemo(() => {
    if (drawnNodes.length === nodes.length) return positions;
    return new Map(drawnNodes.map((node) => [node.id, positions.get(node.id)!]));
  }, [drawnNodes, nodes.length, positions]);

  // ── Mutations ──────────────────────────────────────────────

  /** Runs one graph mutation, holding the canvas still and surfacing the reason if it fails. */
  const runMutation = useCallback(
    async (mutation: () => Promise<void>, fallbackMessage: string) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await mutation();
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : fallbackMessage);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const handleMove = useCallback(
    (id: string, point: GraphPoint) => {
      const node = nodeById.get(id);
      if (!node) return;
      const centre = { x: Math.round(point.x), y: Math.round(point.y) };

      // A drag while an arrangement is being reviewed edits that arrangement rather than saving on
      // its own: saving one card out of a layout the author has not accepted would leave the graph
      // half in each.
      if (preview) {
        setPreview({ ...preview, [id]: centre });
        return;
      }

      setOverrides((current) => ({ ...current, [id]: centre }));
      void runMutation(
        () => onPositionChange(node, centre.x, centre.y),
        "The node position could not be saved.",
      );
    },
    [nodeById, onPositionChange, preview, runMutation],
  );

  const handleConnect = useCallback(
    (blockerId: string, nodeId: string) => {
      const refusal = edgeRefusal(nodes, nodeId, blockerId);
      if (refusal) {
        setSaveError(EDGE_REFUSAL_MESSAGE[refusal]);
        return;
      }
      const blocked = nodeById.get(nodeId);
      if (!blocked) return;
      void runMutation(
        () => onAddBlocker(blocked, blockerId),
        "The connection could not be saved.",
      );
    },
    [nodeById, nodes, onAddBlocker, runMutation],
  );

  const handleDisconnect = useCallback(
    (blockerId: string, nodeId: string) => {
      const blocked = nodeById.get(nodeId);
      if (!blocked) return;
      void runMutation(
        () => onRemoveBlocker(blocked, blockerId),
        "The connection could not be removed.",
      );
    },
    [nodeById, onRemoveBlocker, runMutation],
  );

  /**
   * Makes a node at a point on the canvas.
   *
   * Both ways in say *where* the node goes: a double-click puts it under the pointer, and the
   * toolbar button puts it in the middle of what is on screen. A node that appears somewhere the
   * author has to go looking for it is a node they will think failed to appear.
   */
  const createAt = useCallback(
    (kindId: string, point: GraphPoint) => {
      if (!onCreateNode) return;
      void runMutation(
        () => onCreateNode(kindId, Math.round(point.x), Math.round(point.y)),
        "The node could not be created.",
      );
    },
    [onCreateNode, runMutation],
  );

  /** Lays every node out again and shows the result, without saving any of it. */
  const handleTidyUp = useCallback(() => {
    setPreview(Object.fromEntries(layeredLayout(nodes, BLUEPRINT_LAYOUT)));
    setArrangement((count) => count + 1);
  }, [nodes]);

  /** Writes the proposed arrangement back, one card at a time, and only where it differs. */
  const handleAcceptPreview = useCallback(() => {
    if (!preview) return;
    const accepted = preview;

    void runMutation(async () => {
      for (const node of nodes) {
        const target = accepted[node.id];
        if (!target) continue;
        const x = Math.round(target.x);
        const y = Math.round(target.y);
        if (node.graphX === x && node.graphY === y) continue;
        await onPositionChange(node, x, y);
      }
      setPreview(null);
    }, "The layout could not be saved.");
  }, [nodes, onPositionChange, preview, runMutation]);

  const handleDiscardPreview = useCallback(() => {
    setPreview(null);
    setArrangement((count) => count + 1);
  }, []);

  /**
   * Arrow keys move between nodes.
   *
   * Listened for on the surface rather than on a node: the canvas owns the pointer gestures and the
   * zoom keys, and which node is "left" of this one is a question about the graph, not about the
   * DOM order the nodes happen to be in. See {@link keyboardNeighbour} for what "left" means.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const directions: Record<string, GraphDirection> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = directions[event.key];
      if (!direction) return;
      // Inside a field, an arrow key is a cursor.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }

      const from = selectedId ?? [...entryPoints][0] ?? nodes[0]?.id;
      if (!from) return;

      const geometry: GraphPositions = Object.fromEntries(positions);
      const next = selectedId === null ? from : keyboardNeighbour(nodes, geometry, from, direction);
      if (!next) return;

      event.preventDefault();
      setSelectedId(next);
    },
    [entryPoints, nodes, positions, selectedId],
  );

  const openNode = openNodeId ? (nodeById.get(openNodeId) ?? null) : null;
  const detail = openNode && renderNodeDetail ? renderNodeDetail(openNode) : null;

  /**
   * Where forward and back go from the opened node.
   *
   * The arrows follow the arrows: back is something this node waits for, forward is something it
   * opens up. That is the order a blueprint actually has, and the one somebody reading it is
   * walking.
   *
   * Where a node has neither — most of them, on a blueprint nobody has connected yet — the step
   * falls back to the author's own order, which is the order the nodes were handed to this canvas.
   * A control that does nothing on most of a graph teaches people it is broken; one that says
   * which of the two it just did is honest about the difference. That is what the labels are for.
   */
  const neighbours = useMemo(() => {
    if (!openNode) return { previous: null, next: null };
    const index = nodes.findIndex((node) => node.id === openNode.id);
    const waitsFor = nodes.filter((node) => openNode.blockerIds.includes(node.id));
    const opens = nodes.filter((node) => node.blockerIds.includes(openNode.id));
    return {
      // The last prerequisite the author wrote and the first thing it opens: the nearest neighbour
      // on each side, by the only order there is to be near in.
      previous: waitsFor.length
        ? { node: waitsFor[waitsFor.length - 1], relation: "Waits for" }
        : index > 0
          ? { node: nodes[index - 1], relation: "Previous" }
          : null,
      next: opens.length
        ? { node: opens[0], relation: "Opens" }
        : index >= 0 && index < nodes.length - 1
          ? { node: nodes[index + 1], relation: "Next" }
          : null,
    };
  }, [nodes, openNode]);

  const goToNeighbour = useCallback(
    (side: "previous" | "next") => {
      const target = neighbours[side];
      if (target) onNavigateNodeDetail?.(target.node.id);
    },
    [neighbours, onNavigateNodeDetail],
  );

  /**
   * A two-finger swipe across the opened page steps to the neighbour the arrows point at.
   *
   * Scoped to the page itself: the graph under it marks the whole pane as somewhere the page's own
   * swipe must keep its hands off, because a swipe there pans the canvas. A page drawn on top of
   * it is not the canvas, and this is the one gesture it wants.
   */
  const swipeRef = useHorizontalWheelNavigation<HTMLDivElement>({
    onNext: () => goToNeighbour("next"),
    onPrevious: () => goToNeighbour("previous"),
    enabled: !!detail && !!onNavigateNodeDetail,
    boundary: "self",
  });

  /**
   * Flies back out when the opened node is shut.
   *
   * Only on the way out. Flying in is done before the caller is told the node was clicked, so that
   * what opens is already what fills the screen — see the select handler below.
   */
  const wasOpenRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = wasOpenRef.current;
    wasOpenRef.current = openNodeId;
    if (previous && !openNodeId) void camera.current?.flyToFit();
    // Stepping from one node to the next takes the graph underneath with it, so closing lands on
    // the node that was actually being read rather than on the one it was entered from.
    if (previous && openNodeId && previous !== openNodeId) {
      void camera.current?.zoomIntoNode(openNodeId, 260);
    }
  }, [openNodeId]);

  /** Escape is how everything in this app that took the screen gives it back. */
  useEffect(() => {
    if (!detail || !onCloseNodeDetail) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Inside a field or a dialog, Escape belongs to that. A confirmation about unsaved work is
      // the worst possible thing to dismiss by closing the thing it is asking about.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [role="dialog"]')
      ) {
        return;
      }
      onCloseNodeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, onCloseNodeDetail]);

  const openNodeById = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      if (!node) return;
      if (!renderNodeDetail) {
        onNodeClick(node);
        return;
      }
      // The camera lands first and the node opens into what it landed on. Telling the caller first
      // would open a page over a graph still on its way there, which reads as two things happening
      // rather than one thing being entered.
      setFlyingInto(id);
      void (async () => {
        await camera.current?.zoomIntoNode(id, 380);
        setFlyingInto(null);
        onNodeClick(node);
      })();
    },
    [nodeById, onNodeClick, renderNodeDetail],
  );

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
            fitKey={`${fitSubject}|${arrangement}|${chainOnly ? "chain" : "all"}`}
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
            onSelect={(id) => {
              if (id === null) {
                setSelectedId(null);
                return;
              }
              setSelectedId(id);
              openNodeById(id);
            }}
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
              const half = halfOfEdge(blocker.id, node.id);
              if (half) return HALF_EDGE[half];
              return edgeTone?.(node, blocker.id) ?? "rule";
            }}
            canMove={editable}
            onMove={handleMove}
            canConnect={editable}
            onConnect={handleConnect}
            onDisconnect={editable ? handleDisconnect : undefined}
            onCanvasDoubleClick={
              canAuthor && createKinds[0]
                ? // The first kind, on a surface that has more than one: the toolbar names them
                  // all, and a double-click cannot ask which.
                  (point) => createAt(createKinds[0].id, point)
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
              const half = halfOfNode(node.id);
              return (
                <div
                  data-testid={`graph-node-${node.id}`}
                  // Which half of the lit run this card is in, as an attribute as well as a
                  // colour: the colour is the answer for a reader, and this is the one thing a
                  // test can hold on to without asserting a class name.
                  data-chain-half={half ?? undefined}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === node.id ? null : current))
                  }
                  className={`relative h-full w-full rounded-xl transition-opacity duration-200 ${
                    dimmed ? "opacity-35" : "opacity-100"
                  } ${
                    half
                      ? HALF_RING[half]
                      : node.id === selectedId
                        ? "ring-2 ring-app-focus ring-offset-2 ring-offset-app-bg-soft"
                        : ""
                  }`}
                >
                  {renderNode(node, {
                    disabled: isSaving,
                    zoom: state.zoom,
                    highlighted: node.id === focusId,
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
                      className="h-8 w-44 rounded-lg border border-app-border bg-app-surface/95 pr-2 pl-8 text-xs text-app-text shadow-sm backdrop-blur placeholder:text-app-text-subtle focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
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
                    <p className="mt-1 flex flex-col gap-1 text-[11px] text-app-text-muted">
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
              preview ? (
                // The proposal states what it did and what happens next, because "Tidy up" has
                // already redrawn the canvas by the time this is read: without the sentence, an
                // author cannot tell an applied change from an offered one.
                <div className="flex flex-col gap-2 rounded-2xl border border-app-brand-border bg-app-surface p-3 shadow-app-brand-lift">
                  <p className="text-sm font-semibold text-app-text">Laid out by prerequisite</p>
                  <p className="text-xs text-app-text-muted">
                    Nothing is saved yet. Drag any card to adjust it first, or put the old
                    arrangement back.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleAcceptPreview}>
                      Keep this
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleDiscardPreview}>
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
                        onClick={() => createAt(kind.id, camera.current?.viewCenter() ?? zero)}
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
                  <CanvasButton label="Tidy up" onClick={handleTidyUp}>
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
              className="absolute bottom-4 left-4 z-40 max-w-sm rounded-lg bg-app-danger-bg px-3 py-2 text-xs text-app-danger-text shadow-lg"
            >
              {saveError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const zero: GraphPoint = { x: 0, y: 0 };

/** Where one step forward or back from an opened node goes, and what that step is. */
type NodeStep = { node: { id: string; title: string }; relation: string };

/**
 * One step either side of the opened node.
 *
 * Carries the title, not only a chevron: two chevrons say "there is more this way", which is the
 * one thing somebody already knew. The relation in front of it says whether this is the blueprint's
 * own order or merely the author's list order, so a step never quietly claims to be a prerequisite.
 *
 * A side with nowhere to go is drawn disabled rather than removed, because the pair is also how
 * somebody learns the swipe exists, and a control that comes and goes is one nobody trusts.
 */
function StepButton({
  step,
  side,
  onGo,
}: {
  step: NodeStep | null;
  side: "previous" | "next";
  onGo: (side: "previous" | "next") => void;
}) {
  const Chevron = side === "previous" ? ChevronLeft : ChevronRight;
  const label = step
    ? `${step.relation}: ${step.node.title}`
    : side === "previous"
      ? "Nothing before this one"
      : "Nothing after this one";

  return (
    <button
      type="button"
      disabled={!step}
      onClick={() => onGo(side)}
      aria-label={label}
      title={`${label} (or swipe sideways)`}
      className={`flex max-w-40 items-center gap-1 rounded-xl border border-app-border/70 px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        step
          ? "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
          : "text-app-text-subtle"
      } ${side === "next" ? "flex-row-reverse" : ""}`}
    >
      <Chevron className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 truncate sm:inline">{step?.node.title ?? "—"}</span>
    </button>
  );
}

/**
 * A node zoomed into until it is a page, with the way back out along the top.
 *
 * The same move the journey makes when a hire opens a step, and for the same reason: a graph is
 * where this work happens, so the thing being edited should open *inside* it rather than beside
 * it. A side panel put a form next to a picture of the very thing the form was about, and spent
 * two thirds of a screen on the picture nobody was reading while they typed.
 *
 * The camera is already inside the node by the time this is drawn, so what is behind the blur is
 * the node itself — which is what makes closing it read as stepping back out rather than as a
 * sheet sliding away.
 */
function NodeCover({
  title,
  context,
  footer,
  onBack,
  surfaceRef,
  previous,
  next,
  onGo,
  children,
}: {
  title: string;
  /** What this node is part of — the path, the phase. Empty on a canvas with no heading of its own. */
  context?: string;
  footer?: ReactNode;
  onBack: () => void;
  /** Takes the swipe gesture, so the whole page is what a two-finger flick lands on. */
  surfaceRef?: RefCallback<HTMLDivElement>;
  previous: NodeStep | null;
  next: NodeStep | null;
  onGo: (side: "previous" | "next") => void;
  children: ReactNode;
}) {
  return (
    /*
      Pressing beside the page closes it. Dismissing a layer that way is the one gesture nobody has
      to be taught, and what is behind this one is the graph the page was opened from. Escape does
      the same thing from the keyboard and the header carries the way back in words, so this is a
      shortcut rather than the only way out.
    */
    <div
      ref={surfaceRef}
      className="absolute inset-0 flex items-stretch justify-center bg-app-bg-soft/70 p-3 backdrop-blur-sm sm:p-6"
      onPointerDown={(event) => {
        // Only the backdrop itself. A pointer that went down inside the page and came up out here
        // is the end of a text selection, not somebody aiming at the graph.
        if (event.target === event.currentTarget) onBack();
      }}
    >
      <motion.section
        aria-label={title}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface shadow-2xl"
      >
        <header className="border-b border-app-border bg-app-brand-soft/30 px-4 py-3 sm:px-6">
          <nav
            aria-label="Where you are"
            className="flex min-w-0 items-center gap-1 text-xs text-app-text-muted"
          >
            <button
              type="button"
              onClick={onBack}
              title="Back to the graph (Esc, or click beside this)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-app-surface-hover hover:text-app-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {context ? `Back to ${context}` : "Back to the graph"}
            </button>
          </nav>
          {/*
            No shrink-back button in the corner. There were three ways out of this page and one of
            them was a glyph somebody had to find and aim at, next to a link that already said
            where it went in words.
          */}
          <div className="mt-1.5 flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 text-lg leading-snug font-bold text-app-text sm:text-xl">
              {title}
            </h3>
            {/*
              In the header rather than as arrows floating beside the page. The page is as wide as
              the canvas allows, so on most screens there is no room beside it to float anything —
              and an arrow out there could say only "that way", where these say where they go.
            */}
            {previous || next ? (
              <nav
                aria-label="Steps either side of this one"
                className="flex shrink-0 items-center gap-1"
              >
                <StepButton step={previous} side="previous" onGo={onGo} />
                <StepButton step={next} side="next" onGo={onGo} />
              </nav>
            ) : null}
          </div>
        </header>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-app-border bg-app-surface-muted px-4 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}

/**
 * What the one relation on this canvas means, spelled out.
 *
 * Without it an arrow gets read as a suggested route and the absence of one as "do these in the
 * order they are drawn" — both wrong, and both invisible until a hire is standing in front of a
 * locked phase asking why.
 */
function GraphLegend({ editable, onClose }: { editable: boolean; onClose: () => void }) {
  return (
    <div className="relative flex max-w-96 flex-col gap-2 rounded-2xl border border-app-border bg-app-surface/95 p-3 pr-8 text-[11px] leading-snug text-app-text-muted shadow-md backdrop-blur">
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide the legend"
        className="absolute top-2 right-2 rounded p-0.5 text-app-text-subtle transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="flex items-center gap-2">
        <svg width="34" height="10" aria-hidden="true" className="shrink-0 overflow-visible">
          <defs>
            <marker
              id="legend-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L0,5 L7,2.5 z" className="fill-app-text-muted" />
            </marker>
          </defs>
          {/* The same curve the canvas draws, so the legend explains what is actually on screen. */}
          <path
            d="M0,9 C10,9 16,1 26,1"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="stroke-app-text-muted"
            markerEnd="url(#legend-arrow)"
          />
        </svg>
        {LOCK_SENTENCE}
      </span>
      <span className="flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 shrink-0 text-app-brand" aria-hidden="true" />
        Nothing has to happen before these — any of them is a place to start.
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="flex shrink-0 flex-col gap-1">
          <span className="h-0.5 w-6 rounded-full bg-app-orange-text" />
          <span className="h-0.5 w-6 rounded-full bg-app-brand" />
        </span>
        Point at a node and its run lights up: orange for what has to happen before it, the brand
        colour for what finishing it opens.
      </span>
      <span className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        &ldquo;Only for &hellip;&rdquo; is the other kind of lock: a skill or role gate, so the node
        opens for some people and not others.
      </span>
      <span>
        Nodes with no arrow between them are in <strong className="font-semibold">no</strong>{" "}
        particular order, and say so. &ldquo;2 of 4&rdquo; counts only within one chain.
      </span>
      {editable ? (
        <span className="text-app-text-subtle">
          Click a node to edit it, double-click the canvas to make one. To lock one behind another,
          drag from the dot under the first onto the second. Click an arrow to pick it out, then
          remove it with Backspace or the button on it.
        </span>
      ) : null}
    </div>
  );
}
