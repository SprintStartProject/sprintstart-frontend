import dagre from "dagre";

/**
 * The geometry and the graph rules of the Blueprint canvas, kept apart from the canvas itself.
 *
 * Everything here is a pure function of the nodes it is handed, which is the point: the rules that
 * decide whether an edge may exist, where an unplaced node lands and what "tidy up" does are the
 * parts worth testing, and none of them need a DOM to be true.
 *
 * **What an edge means.** A node's `blockerIds` are the nodes that must be finished before it opens
 * — a hard lock, not a suggestion. That is the only relationship the Blueprint model has; the order
 * a node sits in (`position`) is a suggestion and is not drawn here. Everything in this module that
 * talks about "reaching" walks that lock relation in the direction a reader would: from a node to
 * the things it waits on.
 */

/**
 * The card box on the canvas, fixed — and the card is drawn at exactly this size.
 *
 * Fixed rather than measured because dagre needs a size before React Flow has laid anything out,
 * and because two cards of different heights in one rank make a tidy layout look untidy.
 *
 * The height used to be an estimate the card was free to exceed: a title over two lines, a line of
 * context, a requirements line and a row of chips came to about 180px against an assumed 116, so
 * every gap the layout left was too small and cards sat on top of each other. Both the geometry and
 * the card now read this, so they cannot drift apart again.
 */
export const GRAPH_NODE_WIDTH = 248;
export const GRAPH_NODE_HEIGHT = 168;

/** The grid an unplaced node falls into, and the spacing "tidy up" lays chains out on. */
const COLUMN_STEP = GRAPH_NODE_WIDTH + 80;
const ROW_STEP = GRAPH_NODE_HEIGHT + 56;
const COLUMNS_PER_ROW = 4;

/**
 * Below this zoom a card stops trying to say everything and shows only its title.
 *
 * A sixteen-phase blueprint has to be readable at a zoom where the whole thing fits, and at that
 * size a three-line description is a grey smear that costs layout work to produce.
 */
export const COMPACT_DETAIL_ZOOM = 0.62;

/** What the canvas rules need to know about a node. Both graph levels satisfy this. */
export type GraphRuleNode = {
  id: string;
  graphX: number | null;
  graphY: number | null;
  /** Nodes that must be finished before this one opens. */
  blockerIds: string[];
  /**
   * The order this node is listed in, which is a suggestion and not a rule.
   *
   * Never drawn and never used to sequence anything — the arrows are the only order this model
   * has. It is read in one place only: as the order nodes are handed to the layout, so that two
   * phases nothing sequences come out in the order their author listed them rather than in
   * whatever order the algorithm happened to settle on.
   */
  position?: number;
};

export type GraphPoint = { x: number; y: number };
export type GraphPositions = Record<string, GraphPoint>;

/**
 * Whether `nodeId` can reach `targetId` by walking what it waits on.
 *
 * Counts its own steps rather than trusting the data: a ring that somehow got stored would
 * otherwise hang the render that called this.
 */
function reaches(nodes: readonly GraphRuleNode[], nodeId: string, targetId: string): boolean {
  const blockersById = new Map(nodes.map((node) => [node.id, node.blockerIds]));
  const seen = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (current === targetId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(blockersById.get(current) ?? []));
  }

  return false;
}

/**
 * Why an edge from `blockerId` to `blockedId` cannot be drawn, or `null` when it can.
 *
 * Answered before the drag finishes rather than after the request fails. The backend refuses both
 * of these too (400 for a cycle, 403 for a duplicate), but a handle that takes a connection and
 * then shows an error box has already told the author the edge was fine.
 *
 * A cycle is refused because nothing in a ring can ever be first: every node it touches would be
 * locked forever on every hire's path, and the person who drew it would have no way to see why.
 */
export type EdgeRefusal = "self" | "duplicate" | "cycle";

export function edgeRefusal(
  nodes: readonly GraphRuleNode[],
  blockedId: string,
  blockerId: string,
): EdgeRefusal | null {
  if (blockedId === blockerId) return "self";

  const blocked = nodes.find((node) => node.id === blockedId);
  if (blocked?.blockerIds.includes(blockerId)) return "duplicate";

  // Walking from the proposed blocker: if it already waits on the node we are about to block,
  // this edge closes the ring.
  if (reaches(nodes, blockerId, blockedId)) return "cycle";

  return null;
}

/** The sentence shown when a connection is refused. */
export const EDGE_REFUSAL_MESSAGE: Record<EdgeRefusal, string> = {
  self: "A node cannot wait for itself.",
  duplicate: "These two are already connected.",
  cycle: "That would make them wait for each other, so neither could ever start.",
};

/** Convenience wrapper for React Flow's `isValidConnection`, which only wants a yes or no. */
export function canConnect(
  nodes: readonly GraphRuleNode[],
  blockedId: string,
  blockerId: string,
): boolean {
  return edgeRefusal(nodes, blockedId, blockerId) === null;
}

/**
 * The nodes nothing else has to happen before: where a reader starts.
 *
 * Only counts blockers that are actually on the canvas. A node waiting on something that was
 * returned to the library is waiting on nothing anybody can see, and calling it a starting point
 * is the honest reading — the edge is gone from the picture either way.
 */
export function entryPointIds(nodes: readonly GraphRuleNode[]): Set<string> {
  const drawn = new Set(nodes.map((node) => node.id));

  return new Set(
    nodes
      .filter((node) => node.blockerIds.every((blockerId) => !drawn.has(blockerId)))
      .map((node) => node.id),
  );
}

/** Walks one relation from `rootId` and returns everything it reaches, `rootId` excluded. */
function walk(edges: Map<string, string[]>, rootId: string): Set<string> {
  const reached = new Set<string>();
  const queue = [...(edges.get(rootId) ?? [])];

  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (current === rootId || reached.has(current)) continue;
    reached.add(current);
    queue.push(...(edges.get(current) ?? []));
  }

  return reached;
}

function blockerEdges(nodes: readonly GraphRuleNode[]): Map<string, string[]> {
  return new Map(nodes.map((node) => [node.id, node.blockerIds]));
}

function dependentEdges(nodes: readonly GraphRuleNode[]): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const node of nodes) {
    for (const blockerId of node.blockerIds) {
      edges.set(blockerId, [...(edges.get(blockerId) ?? []), node.id]);
    }
  }
  return edges;
}

/**
 * Everything `rootId` waits on, however far back — `rootId` itself excluded.
 *
 * Kept apart from what waits on it, because the two are different questions and the answers get
 * different treatment when a reader points at a node. What comes *before* is the constraint: these
 * are the reasons the node is shut. What comes *after* is the consequence: this is what opening it
 * would let through. Lit in one colour, a chain says "these are related"; lit in two, it says which
 * half is holding you up and which half you are holding up.
 */
export function blockersBehind(nodes: readonly GraphRuleNode[], rootId: string): Set<string> {
  return walk(blockerEdges(nodes), rootId);
}

/** Everything waiting on `rootId`, however far forward — `rootId` itself excluded. */
export function dependentsAhead(nodes: readonly GraphRuleNode[], rootId: string): Set<string> {
  return walk(dependentEdges(nodes), rootId);
}

/**
 * Everything `rootId` waits on, everything that waits on it, and itself.
 *
 * The one question a prerequisite graph is asked is "what does this depend on and what depends on
 * this", and answering it by pointing is the reason to draw the graph rather than list it.
 */
export function chainFor(nodes: readonly GraphRuleNode[], rootId: string): Set<string> {
  return new Set([rootId, ...blockersBehind(nodes, rootId), ...dependentsAhead(nodes, rootId)]);
}

/** The grid cell a position sits in, so a fallback placement can avoid an occupied one. */
function cellKey(position: GraphPoint): string {
  return `${Math.round(position.x / COLUMN_STEP)}:${Math.round(position.y / ROW_STEP)}`;
}

function cellPosition(index: number): GraphPoint {
  return {
    x: (index % COLUMNS_PER_ROW) * COLUMN_STEP,
    y: Math.floor(index / COLUMNS_PER_ROW) * ROW_STEP,
  };
}

/**
 * Every node given a position: the stored one where there is one, the first free grid cell where
 * there is not.
 *
 * A personalized path copied from a blueprint whose author never opened the graph has no
 * coordinates at all, and a canvas that dropped those on the origin would stack sixteen phases on
 * one spot. Free cells are taken in the order the nodes arrive, so opening the graph twice puts the
 * same node in the same place.
 */
export function withFallbackPositions(nodes: readonly GraphRuleNode[]): GraphPositions {
  const resolved: GraphPositions = {};
  const taken = new Set(
    nodes
      .filter((node) => node.graphX !== null && node.graphY !== null)
      .map((node) => cellKey({ x: node.graphX as number, y: node.graphY as number })),
  );

  let next = 0;
  for (const node of nodes) {
    if (node.graphX !== null && node.graphY !== null) {
      resolved[node.id] = { x: node.graphX, y: node.graphY };
      continue;
    }

    while (taken.has(cellKey(cellPosition(next)))) next += 1;
    const free = cellPosition(next);
    taken.add(cellKey(free));
    resolved[node.id] = free;
  }

  return resolved;
}

/**
 * Where the canvas draws a set of nodes before anybody has dragged anything.
 *
 * Two cases, and the difference between them is whether there is an arrangement to respect. Once
 * one node has coordinates somebody put them there, so the stored arrangement is kept and anything
 * without coordinates falls into a free grid cell beside it. When *nothing* has coordinates there
 * is nothing to preserve, and a grid that knows no dependencies is strictly worse than a layout
 * that does — so the graph is laid out properly instead. That is the common case in the hire's
 * read-only view of a path copied from a blueprint whose author never opened the graph.
 *
 * Drawing only, either way. Nothing here is written back.
 */
export function arrangementFor(nodes: readonly GraphRuleNode[]): GraphPositions {
  const anyStored = nodes.some((node) => node.graphX !== null && node.graphY !== null);
  return anyStored ? withFallbackPositions(nodes) : autoLayoutPositions(nodes);
}

/**
 * Everything laid out from scratch, chains running left to right.
 *
 * The button behind this is an escape hatch, not a mode. Nothing calls it on its own: an
 * arrangement somebody has been dragging into shape for a month is worth more than any layout an
 * algorithm produces. But a graph that has drifted into a knot needs one click to become readable
 * again, and untangling sixteen phases by hand is not that.
 *
 * Nodes with no edges are laid out too — dagre gives every disconnected node its own rank, which
 * would spread eight unsequenced phases across the width of the screen, so they are packed into a
 * grid below the chains instead.
 */
export function autoLayoutPositions(nodes: readonly GraphRuleNode[]): GraphPositions {
  if (nodes.length === 0) return {};

  const ids = new Set(nodes.map((node) => node.id));
  // The order nodes are handed to dagre seeds its own ordering pass, so it decides which of two
  // phases in the same rank sits on top. Left alone that is an implementation detail nobody can
  // predict; seeded with the author's own listing order it is at least the answer they expect.
  const inListOrder = [...nodes].sort(
    (left, right) =>
      (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
  );
  const hasDrawnEdge = (node: GraphRuleNode) =>
    node.blockerIds.some((blockerId) => ids.has(blockerId)) ||
    nodes.some((other) => other.blockerIds.includes(node.id));
  const connected = inListOrder.filter(hasDrawnEdge);
  const loose = inListOrder.filter((node) => !hasDrawnEdge(node));

  const positions: GraphPositions = {};
  let looseTop = 0;

  if (connected.length > 0) {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: "LR",
      // Ranks line up at the top rather than being centred on each other. Centred ranks put a
      // one-node rank halfway down beside a four-node one, which reads as a position that means
      // something; aligned, a rank is a column and the eye can follow it.
      align: "UL",
      // Generous on both axes, because the edges are curves now and a curve needs room to be one:
      // packed ranks turn every connection into a short straight dash between two borders.
      ranksep: 150,
      nodesep: 64,
      marginx: 0,
      marginy: 0,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const node of connected) {
      graph.setNode(node.id, {
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
      });
    }
    for (const node of connected) {
      for (const blockerId of node.blockerIds) {
        if (ids.has(blockerId)) graph.setEdge(blockerId, node.id);
      }
    }

    dagre.layout(graph);

    // Dagre centres its nodes; React Flow places them by the top-left corner.
    const laidOut = connected.map((node) => {
      const placed = graph.node(node.id) as { x?: number; y?: number } | undefined;
      return {
        id: node.id,
        x: (placed?.x ?? GRAPH_NODE_WIDTH / 2) - GRAPH_NODE_WIDTH / 2,
        y: (placed?.y ?? GRAPH_NODE_HEIGHT / 2) - GRAPH_NODE_HEIGHT / 2,
      };
    });

    const offsetX = -Math.min(...laidOut.map((node) => node.x));
    const offsetY = -Math.min(...laidOut.map((node) => node.y));
    for (const node of laidOut) {
      positions[node.id] = {
        x: Math.round(node.x + offsetX),
        y: Math.round(node.y + offsetY),
      };
    }

    looseTop =
      Math.max(...Object.values(positions).map((position) => position.y)) + ROW_STEP + ROW_STEP / 2;
  }

  // Unsequenced nodes go in a block under the chains, as wide as the chains are: a fixed four
  // columns either left a narrow graph with a block sticking out past it, or stacked eight loose
  // phases into a tall tower beside a wide layout.
  const chainWidth =
    connected.length > 0 ? Math.max(...Object.values(positions).map((point) => point.x)) : 0;
  const looseColumns = Math.max(
    1,
    Math.min(loose.length, Math.round(chainWidth / COLUMN_STEP) + 1),
  );

  loose.forEach((node, index) => {
    positions[node.id] = {
      x: (index % looseColumns) * COLUMN_STEP,
      y: looseTop + Math.floor(index / looseColumns) * ROW_STEP,
    };
  });

  return positions;
}

/**
 * Title size for a card that has been zoomed away from, in canvas pixels.
 *
 * Divides by the zoom, so the result is roughly constant *on screen*: at the zoom where sixteen
 * phases fit at once, this is a label somebody can read instead of a five-pixel smear. Capped at
 * both ends — below 13 there is nothing to correct, and past 40 the title outgrows its own card.
 */
export function compactTitlePx(zoom: number): number {
  return Math.min(40, Math.max(13, 13 / zoom));
}

/** Where a node sits inside the one chain it belongs to. */
export type ChainPosition = { index: number; total: number };

/**
 * A position for every node that is actually part of a chain, and nothing for every node that is not.
 *
 * This is the honest half of "what order do I do these in". A prerequisite graph does not have one
 * order — that is why it is a graph — so numbering all sixteen phases 1..16 would invent a sequence
 * the model never claimed, and a reader who followed it would believe things were required that are
 * not. But *within* a run of nodes that really do wait on each other there is an order, and it is
 * the first thing anybody wants to know.
 *
 * So: nodes are grouped into connected runs by their edges, ignoring direction — two nodes that
 * share a chain belong to the same run whichever way the arrow points. A run of one is not a chain
 * and gets nothing. Inside a run, the order is topological with ties broken by the order the nodes
 * arrive in, which is the author's own `position`, so the same graph always numbers the same way.
 *
 * A run that contains a ring is skipped entirely: nothing in it can be first, and a number would
 * paper over exactly the mistake worth seeing.
 */
export function chainPositions(nodes: readonly GraphRuleNode[]): Map<string, ChainPosition> {
  const drawn = new Set(nodes.map((node) => node.id));
  const neighbours = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set()]));
  for (const node of nodes) {
    for (const blockerId of node.blockerIds) {
      if (!drawn.has(blockerId)) continue;
      neighbours.get(node.id)?.add(blockerId);
      neighbours.get(blockerId)?.add(node.id);
    }
  }

  const positions = new Map<string, ChainPosition>();
  const assigned = new Set<string>();

  for (const start of nodes) {
    if (assigned.has(start.id)) continue;

    // The whole run this node belongs to, walked without caring about arrow direction.
    const run = new Set<string>();
    const queue = [start.id];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (run.has(current)) continue;
      run.add(current);
      queue.push(...(neighbours.get(current) ?? []));
    }
    for (const id of run) assigned.add(id);
    if (run.size < 2) continue;

    // Topological order inside the run, one node at a time so a chain the author wrote in order
    // stays in that order rather than being interleaved with its own branches.
    const inRun = nodes.filter((node) => run.has(node.id));
    const settled = new Set<string>();
    const ordered: string[] = [];
    while (settled.size < inRun.length) {
      const next = inRun.find(
        (node) =>
          !settled.has(node.id) &&
          node.blockerIds
            .filter((blockerId) => run.has(blockerId))
            .every((blockerId) => settled.has(blockerId)),
      );
      if (!next) break;
      settled.add(next.id);
      ordered.push(next.id);
    }

    // Nothing was ready at some point: the run holds a ring, so none of it gets a number.
    if (ordered.length !== inRun.length) continue;

    ordered.forEach((id, index) => positions.set(id, { index: index + 1, total: ordered.length }));
  }

  return positions;
}

/**
 * Breathing space kept between two drawn cards, on top of the card box itself.
 *
 * Modest on purpose: this pass moves nodes away from where their author put them, so it should do
 * the least that works. But "works" is more than not touching — an edge between two cards a dozen
 * pixels apart is a stub with nowhere to curve, so the gap is wide enough for the arrow between
 * them to be drawn as one.
 */
export const MIN_NODE_GAP = 48;

/**
 * The same positions, with any cards that would sit on top of each other pushed apart.
 *
 * Needed because overlapping coordinates are a thing the data can simply contain. The seeded
 * blueprint is the proof: six of its sixteen phases are stored between 226 and 242 apart on x with
 * almost no difference on y, against a card 248 wide — it was laid out for a narrower card than the
 * one that draws it, and no amount of care in the card fixes a number in the database.
 *
 * **Drawing only.** Nothing here is saved. An author who drags a card onto another gets it nudged
 * clear rather than stacked, and an author who never touches the graph still sees every card.
 *
 * Deterministic: pairs are visited in the order the nodes arrive, each overlap is resolved along
 * whichever axis needs the smaller push, and the sweep repeats a bounded number of times — so the
 * same graph always draws the same way, and a knot that cannot be resolved stops rather than spins.
 */
export function separateOverlaps(
  nodes: readonly GraphRuleNode[],
  positions: GraphPositions,
): GraphPositions {
  const ids = nodes.map((node) => node.id).filter((id) => positions[id] !== undefined);
  const out: GraphPositions = {};
  for (const id of ids) out[id] = { ...positions[id] };

  const minX = GRAPH_NODE_WIDTH + MIN_NODE_GAP;
  const minY = GRAPH_NODE_HEIGHT + MIN_NODE_GAP;
  const MAX_SWEEPS = 24;

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep += 1) {
    let moved = false;

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = out[ids[i]];
        const b = out[ids[j]];
        const overlapX = minX - Math.abs(b.x - a.x);
        const overlapY = minY - Math.abs(b.y - a.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        if (overlapX <= overlapY) {
          // Two cards dead on top of each other have no axis to be pushed along, so one is picked
          // — by arrival order, so it is the same one every time.
          const direction = b.x === a.x ? 1 : Math.sign(b.x - a.x);
          a.x -= (direction * overlapX) / 2;
          b.x += (direction * overlapX) / 2;
        } else {
          const direction = b.y === a.y ? 1 : Math.sign(b.y - a.y);
          a.y -= (direction * overlapY) / 2;
          b.y += (direction * overlapY) / 2;
        }
      }
    }

    if (!moved) break;
  }

  for (const id of ids) {
    out[id] = { x: Math.round(out[id].x), y: Math.round(out[id].y) };
  }
  return out;
}

/** How far a control point reaches out of a handle, at the very least. */
const EDGE_MIN_REACH = 72;
/** And at the very most, so a long edge sweeps rather than loops off the canvas. */
const EDGE_MAX_REACH = 260;
/** Below this sideways difference an edge counts as flat and is bowed rather than left straight. */
const EDGE_FLAT_THRESHOLD = 28;

/** Which side of a card an edge leaves from or lands on. */
export type GraphSide = "left" | "right" | "top" | "bottom";

/** The direction a side faces, which is the direction an edge leaves it in. */
const SIDE_NORMAL: Record<GraphSide, GraphPoint> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

/** The two sides an edge between these two card centres should use. */
export type GraphEdgeSides = { source: GraphSide; target: GraphSide };

/**
 * Which sides of two cards the edge between them should connect.
 *
 * Every edge used to leave on the right and land on the left, whatever the two cards' actual
 * arrangement. A card sitting directly below the one it waits on got an edge that left rightwards,
 * turned around and came back — a detour describing nothing, since the relation is the same one an
 * arrow straight down would draw. So the side is picked from where the cards are: the edge leaves
 * towards its target and lands facing where it came from.
 *
 * **Derived, never stored.** The backend has no field for a side and does not need one — move a
 * card and its edges rearrange themselves, which is the behaviour an author expects and the one
 * that cannot go stale.
 *
 * The axis is chosen against the card's own proportions rather than in raw pixels: the card is
 * wider than it is tall, so "150 to the right" is a smaller displacement than "150 below", and
 * comparing the two as bare numbers would send far too many edges out of the top and bottom.
 */
export function edgeSides(source: GraphPoint, target: GraphPoint): GraphEdgeSides {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (Math.abs(dx) / GRAPH_NODE_WIDTH >= Math.abs(dy) / GRAPH_NODE_HEIGHT) {
    return dx >= 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  return dy >= 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
}

/**
 * The shape of an edge: one cubic curve from the source handle to the target handle.
 *
 * React Flow's own edge types are a staircase (`smoothstep`) or a bezier whose control points reach
 * out by a quarter of the gap — enough to round a corner, not enough to read as a curve. Two cards
 * on the same row got a dead straight dash, and several of those running parallel are hard to tell
 * apart at a glance. So the geometry is ours:
 *
 * - **Each end leaves along the direction its side faces**, so the curve grows out of the card
 *   rather than cutting across its corner.
 * - **Reach** grows with the distance the edge has to cover, bounded at both ends, and never past
 *   halfway on an edge already pointing the right way — past halfway the two control points sit
 *   behind each other's handles and the curve doubles back on itself, which on a short hop between
 *   two neighbours reads as a kink rather than a connection.
 * - **A flat edge is bowed.** Two handles facing each other across an empty run have no direction
 *   for a curve to take, so both control points are pushed sideways by an amount that scales with
 *   the run. That is the swing, and it is what separates two parallel edges that would otherwise
 *   be drawn as one line.
 * - **An edge that has to double back** — a card that waits on one placed after it — keeps the full
 *   reach and loops, which is what makes an edge running against the flow visible as one.
 *
 * Pure geometry, so what the canvas draws can be checked without mounting a canvas.
 */
export function blueprintEdgePath(
  source: GraphPoint,
  target: GraphPoint,
  sides: GraphEdgeSides,
): string {
  const sourceNormal = SIDE_NORMAL[sides.source];
  const targetNormal = SIDE_NORMAL[sides.target];
  const isHorizontal = sourceNormal.x !== 0;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  // Along the axis the handles face; across it for everything else.
  const along = isHorizontal ? dx : dy;
  const across = Math.abs(isHorizontal ? dy : dx);
  const span = Math.abs(along);
  const facesTarget = along * (isHorizontal ? sourceNormal.x : sourceNormal.y) > 0;

  const wanted = Math.max(EDGE_MIN_REACH, span * 0.55 + across * 0.25);
  const reach = Math.min(EDGE_MAX_REACH, facesTarget ? Math.min(wanted, span * 0.5) : wanted);

  // Both control points are offset the same way, which bows the curve rather than tilting it.
  // Proportional, with no floor: a long flat run gets a real swing, and a short hop between two
  // neighbouring cards stays nearly flat rather than kinking over the few pixels it has.
  const bowSize = across < EDGE_FLAT_THRESHOLD ? Math.min(44, span * 0.16) : 0;
  const bow = isHorizontal ? { x: 0, y: bowSize } : { x: bowSize, y: 0 };

  const round = (value: number) => Math.round(value * 100) / 100;
  const control = (point: GraphPoint, normal: GraphPoint) =>
    `${round(point.x + normal.x * reach + bow.x)},${round(point.y + normal.y * reach + bow.y)}`;

  return [
    `M ${round(source.x)},${round(source.y)}`,
    `C ${control(source, sourceNormal)}`,
    control(target, targetNormal),
    `${round(target.x)},${round(target.y)}`,
  ].join(" ");
}

/**
 * How firm one arrow is, on a graph whose arrows do not all come from the same place.
 *
 * A Blueprint has one kind: every arrow is a rule its author wrote. A hire's board has three — a
 * lock the team set, a sequence their buddy proposed, and one the hire arranged themselves — and
 * which it is decides whether they may take it off. Drawn as the line's own weight and dashes
 * rather than only in a tooltip, because "may I move this" is the first question asked of an arrow
 * and a hover is a poor place to answer it.
 *
 * Here rather than in the canvas so that the legend explaining the styles reads the same table the
 * canvas draws from: a legend that restates a style from memory is a legend that goes quietly
 * wrong.
 */
export type GraphEdgeTone = "rule" | "suggestion" | "own";

export const EDGE_TONES: Record<GraphEdgeTone, { dash?: string; width: number; said: string }> = {
  rule: { width: 2.5, said: "set by the team" },
  suggestion: { width: 2, dash: "7 5", said: "suggested by the buddy" },
  own: { width: 1.5, dash: "2 4", said: "arranged by you" },
};
