import type { ReactNode } from "react";
import { type ChainPosition, type JourneyEdgeTone } from "../graphKit.ts";

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

export type Props<TNode extends BlueprintGraphCanvasNode> = {
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
  /**
   * Opening a node. Left out on a canvas that only shows a picture -- the board's chain panel --
   * where the nodes then stop being tab stops that do nothing when pressed.
   */
  onNodeClick?: (node: TNode) => void;
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
   * something the author cannot see. Opening goes through `onNodeClick`, which is also
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
