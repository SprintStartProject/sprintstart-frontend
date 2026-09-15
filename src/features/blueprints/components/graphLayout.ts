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

/**
 * Everything `rootId` waits on, everything that waits on it, and itself.
 *
 * This is what gets lit when a node is selected: the one question a prerequisite graph is asked is
 * "what does this depend on and what depends on this", and answering it by pointing is the reason
 * to draw the graph rather than list it.
 */
export function chainFor(nodes: readonly GraphRuleNode[], rootId: string): Set<string> {
  const blockersById = new Map(nodes.map((node) => [node.id, node.blockerIds]));
  const dependentsById = new Map<string, string[]>();
  for (const node of nodes) {
    for (const blockerId of node.blockerIds) {
      dependentsById.set(blockerId, [...(dependentsById.get(blockerId) ?? []), node.id]);
    }
  }

  const chain = new Set<string>();
  for (const edges of [blockersById, dependentsById]) {
    // Visited is per direction: sharing one set across both would stop the second walk at the root,
    // which is already in the chain by then, and quietly light only half the chain.
    const visited = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      chain.add(current);
      queue.push(...(edges.get(current) ?? []));
    }
  }

  return chain;
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
  const hasDrawnEdge = (node: GraphRuleNode) =>
    node.blockerIds.some((blockerId) => ids.has(blockerId)) ||
    nodes.some((other) => other.blockerIds.includes(node.id));
  const connected = nodes.filter(hasDrawnEdge);
  const loose = nodes.filter((node) => !hasDrawnEdge(node));

  const positions: GraphPositions = {};
  let looseTop = 0;

  if (connected.length > 0) {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: "LR",
      ranksep: 96,
      nodesep: 40,
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

  loose.forEach((node, index) => {
    const cell = cellPosition(index);
    positions[node.id] = { x: cell.x, y: looseTop + cell.y };
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
 * Small on purpose: this pass moves nodes away from where their author put them, so it should do
 * the least that stops them sitting on each other.
 */
const MIN_NODE_GAP = 12;

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
