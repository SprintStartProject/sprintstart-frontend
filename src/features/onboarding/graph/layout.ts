// ============================================================
// features/onboarding/graph/layout.ts
// ============================================================
// Lays out an onboarding graph -- the phases of a path, or the
// steps and questions of a phase -- when it has no positions of
// its own, and orders its items the way the graph reads.
// ============================================================

export type GraphPoint = { x: number; y: number };

/** The two things layout needs to know about a node: who it is and what it waits on. */
export type LayoutNode = {
  id: string;
  blockerIds: readonly string[];
  graphX?: number | null;
  graphY?: number | null;
};

export type LayoutOptions = {
  /** Distance between the centres of two neighbours in one row. */
  columnGap: number;
  /** Distance between the centres of two consecutive rows. */
  rowGap: number;
  /**
   * Most nodes side by side before a row wraps onto a second line. A path that opens eight phases
   * at once is otherwise one row eight cards wide, which only fits the screen at a size nobody can
   * read. Wrapped lines are staggered by half a column so edges from above pass between cards.
   */
  maxPerRow?: number;
};

export const DEFAULT_LAYOUT: LayoutOptions = { columnGap: 280, rowGap: 170 };

/** The size nodes are drawn at, so a stored layout can be checked for cards on top of each other. */
export type NodeFootprint = { width: number; height: number };

/** Only the edges between nodes of this graph; a blocker filtered out of the path leaves no dangling edge. */
function blockersInGraph(nodes: readonly LayoutNode[]): Map<string, string[]> {
  const ids = new Set(nodes.map((node) => node.id));
  return new Map(
    nodes.map((node) => [node.id, node.blockerIds.filter((id) => ids.has(id) && id !== node.id)]),
  );
}

/**
 * Row of every node: one below the deepest thing it waits on, so everything a node needs sits
 * above it. A cycle -- which the backend refuses, but a graph can still arrive with one -- is cut
 * where it is found instead of recursing forever.
 */
export function computeRanks(nodes: readonly LayoutNode[]): Map<string, number> {
  const blockers = blockersInGraph(nodes);
  const ranks = new Map<string, number>();
  const visiting = new Set<string>();

  const rankOf = (id: string): number => {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const rank = Math.max(-1, ...(blockers.get(id) ?? []).map(rankOf)) + 1;
    visiting.delete(id);
    ranks.set(id, rank);
    return rank;
  };

  nodes.forEach((node) => rankOf(node.id));
  return ranks;
}

/**
 * The nodes in reading order: row by row, and inside a row in the order the layout puts them.
 * The list view uses this so it tells the same story as the graph.
 */
export function orderByGraph<T extends LayoutNode>(nodes: readonly T[]): T[] {
  const rows = arrangeRows(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return rows.flat().map((id) => byId.get(id)!);
}

/**
 * Groups node ids into rows and orders each row so edges cross as little as they reasonably can:
 * a few passes of the barycentre heuristic, pulling every node towards the average column of the
 * nodes it connects to in the row above (and then below). Input order breaks ties, so a graph with
 * no edges keeps the order it came in.
 */
function arrangeRows(nodes: readonly LayoutNode[]): string[][] {
  const ranks = computeRanks(nodes);
  const blockers = blockersInGraph(nodes);
  const dependents = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  blockers.forEach((ids, id) => ids.forEach((blocker) => dependents.get(blocker)?.push(id)));

  const rowCount = Math.max(0, ...ranks.values()) + 1;
  const rows: string[][] = Array.from({ length: nodes.length ? rowCount : 0 }, () => []);
  nodes.forEach((node) => rows[ranks.get(node.id) ?? 0].push(node.id));

  const inputIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const column = new Map<string, number>();
  const indexRow = (row: string[]) => row.forEach((id, index) => column.set(id, index));
  rows.forEach(indexRow);

  const sortRow = (row: string[], neighboursOf: (id: string) => string[]) => {
    const weight = new Map(
      row.map((id) => {
        const neighbours = neighboursOf(id).filter((neighbour) => column.has(neighbour));
        const barycentre = neighbours.length
          ? neighbours.reduce((sum, neighbour) => sum + column.get(neighbour)!, 0) /
            neighbours.length
          : column.get(id)!;
        return [id, barycentre];
      }),
    );
    row.sort(
      (left, right) =>
        weight.get(left)! - weight.get(right)! || inputIndex.get(left)! - inputIndex.get(right)!,
    );
    indexRow(row);
  };

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < rows.length; index += 1) {
      sortRow(rows[index], (id) => blockers.get(id) ?? []);
    }
    for (let index = rows.length - 2; index >= 0; index -= 1) {
      sortRow(rows[index], (id) => dependents.get(id) ?? []);
    }
  }

  return rows;
}

/**
 * A layered top-to-bottom layout, centred on the origin.
 *
 * Top to bottom because that is how the rest of the product already reads these graphs: the
 * buddy's step placement puts a new step *below* what it waits on.
 */
export function layeredLayout(
  nodes: readonly LayoutNode[],
  options: LayoutOptions = DEFAULT_LAYOUT,
): Map<string, GraphPoint> {
  const maxPerRow = Math.max(1, options.maxPerRow ?? Number.POSITIVE_INFINITY);
  const lines = arrangeRows(nodes).flatMap((row) => {
    const chunks: { ids: string[]; stagger: boolean }[] = [];
    for (let start = 0; start < row.length; start += maxPerRow) {
      chunks.push({ ids: row.slice(start, start + maxPerRow), stagger: start > 0 });
    }
    return chunks;
  });
  const positions = new Map<string, GraphPoint>();
  const top = -((lines.length - 1) * options.rowGap) / 2;

  lines.forEach((line, lineIndex) => {
    const offset = line.stagger && line.ids.length >= maxPerRow ? options.columnGap / 2 : 0;
    line.ids.forEach((id, columnIndex) => {
      positions.set(id, {
        x: (columnIndex - (line.ids.length - 1) / 2) * options.columnGap + offset,
        y: top + lineIndex * options.rowGap,
      });
    });
  });

  return positions;
}

/** Whether every node carries a stored position -- only then is the stored layout used as is. */
export function hasStoredLayout(nodes: readonly LayoutNode[]): boolean {
  return (
    nodes.length > 0 &&
    nodes.every(
      (node) =>
        typeof node.graphX === "number" &&
        typeof node.graphY === "number" &&
        Number.isFinite(node.graphX) &&
        Number.isFinite(node.graphY),
    )
  );
}

/** Whether any two stored nodes would be drawn overlapping at the given footprint. */
export function storedLayoutOverlaps(
  nodes: readonly LayoutNode[],
  footprint: NodeFootprint,
): boolean {
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      if (
        Math.abs(a.graphX! - b.graphX!) < footprint.width * 0.92 &&
        Math.abs(a.graphY! - b.graphY!) < footprint.height * 0.92
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Where each node is drawn: its stored position when the whole graph has one, the layered layout
 * otherwise.
 *
 * All or nothing on purpose. Mixing stored positions with computed ones puts two coordinate systems
 * on one canvas -- AI-generated steps arrive without positions next to hand-placed ones, and a
 * computed row at the origin lands straight on top of them.
 *
 * A stored layout whose cards would sit on top of each other is laid out again as well. Blueprints
 * are authored on a canvas with narrower cards, so their positions are often too tight for the cards
 * here -- and a graph whose nodes cover each other says nothing at all.
 */
export function resolveLayout(
  nodes: readonly LayoutNode[],
  options: LayoutOptions = DEFAULT_LAYOUT,
  footprint?: NodeFootprint,
): { positions: Map<string, GraphPoint>; isAutomatic: boolean } {
  if (hasStoredLayout(nodes) && !(footprint && storedLayoutOverlaps(nodes, footprint))) {
    return {
      positions: new Map(nodes.map((node) => [node.id, { x: node.graphX!, y: node.graphY! }])),
      isAutomatic: false,
    };
  }
  return { positions: layeredLayout(nodes, options), isAutomatic: true };
}

/** Every node a node waits on, directly or through anything it waits on. */
export function collectUpstream(nodes: readonly LayoutNode[], id: string): Set<string> {
  const blockers = blockersInGraph(nodes);
  const seen = new Set<string>();
  const stack = [...(blockers.get(id) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(blockers.get(current) ?? []));
  }
  return seen;
}

/** Every node that waits on a node, directly or through anything in between. */
export function collectDownstream(nodes: readonly LayoutNode[], id: string): Set<string> {
  const blockers = blockersInGraph(nodes);
  const dependents = new Map<string, string[]>();
  blockers.forEach((ids, node) =>
    ids.forEach((blocker) => dependents.set(blocker, [...(dependents.get(blocker) ?? []), node])),
  );
  const seen = new Set<string>();
  const stack = [...(dependents.get(id) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(dependents.get(current) ?? []));
  }
  return seen;
}

/** Whether adding the edge `blocker → node` would close a loop. */
export function wouldCreateCycle(
  nodes: readonly LayoutNode[],
  nodeId: string,
  blockerId: string,
): boolean {
  return nodeId === blockerId || collectUpstream(nodes, blockerId).has(nodeId);
}

/** Key of an edge in a route map. */
export const edgeKey = (blockerId: string, nodeId: string) => `${blockerId}->${nodeId}`;

/**
 * Waypoints that take each edge around the cards between its two ends.
 *
 * An edge that skips a row -- or reaches the second line of a wrapped row -- would otherwise be drawn
 * straight through whatever sits in between, and a line under a card reads as a connection to it. For
 * every row an edge passes, it gets one waypoint at that row's height: where the edge would cross
 * anyway if nothing is in the way, else in the nearest gap between two cards (or beside the row).
 * Edges sharing a gap are fanned out a little so they stay tellable apart.
 *
 * Works on any positions, not only on the layered layout's: rows are simply the heights nodes sit at.
 */
export function routeEdges(
  nodes: readonly LayoutNode[],
  positions: ReadonlyMap<string, GraphPoint>,
  footprint: NodeFootprint,
): Map<string, GraphPoint[]> {
  // Rows are cards at roughly the same height -- hand-placed cards are rarely pixel-aligned, and a
  // row per stray pixel put a waypoint on every one of them.
  const rows: { y: number; xs: number[] }[] = [];
  [...positions.entries()]
    .filter(([id]) => nodes.some((node) => node.id === id))
    .map(([, point]) => point)
    .sort((a, b) => a.y - b.y)
    .forEach((point) => {
      const row = rows.find((candidate) => Math.abs(candidate.y - point.y) < footprint.height / 2);
      if (row) row.xs.push(point.x);
      else rows.push({ y: point.y, xs: [point.x] });
    });
  rows.forEach((row) => row.xs.sort((a, b) => a - b));

  const margin = 14;
  const halfWidth = footprint.width / 2;
  const channelUse = new Map<string, number>();
  const routes = new Map<string, GraphPoint[]>();
  const blockers = blockersInGraph(nodes);

  blockers.forEach((blockerIds, nodeId) => {
    const to = positions.get(nodeId);
    if (!to) return;
    blockerIds.forEach((blockerId) => {
      const from = positions.get(blockerId);
      if (!from || to.y - from.y <= footprint.height) return;
      const waypoints: GraphPoint[] = [];
      rows
        .filter(
          (row) => row.y > from.y + footprint.height / 2 && row.y < to.y - footprint.height / 2,
        )
        .forEach(({ y, xs }) => {
          const t = (y - from.y) / (to.y - from.y);
          const ideal = from.x + (to.x - from.x) * t;
          // Nothing in the way: no waypoint, and the curve stays one clean sweep.
          if (!xs.some((x) => Math.abs(x - ideal) < halfWidth + margin)) return;
          const channels = [
            xs[0] - halfWidth - margin * 2,
            xs[xs.length - 1] + halfWidth + margin * 2,
          ];
          for (let index = 1; index < xs.length; index += 1) {
            if (xs[index] - xs[index - 1] >= footprint.width + margin) {
              channels.push((xs[index] + xs[index - 1]) / 2);
            }
          }
          let x = channels.reduce((best, channel) =>
            Math.abs(channel - ideal) < Math.abs(best - ideal) ? channel : best,
          );
          const slot = `${Math.round(y)}:${Math.round(x)}`;
          const used = channelUse.get(slot) ?? 0;
          channelUse.set(slot, used + 1);
          x += (used % 2 === 0 ? 1 : -1) * Math.ceil(used / 2) * 6;
          waypoints.push({ x, y });
        });
      if (waypoints.length) routes.set(edgeKey(blockerId, nodeId), waypoints);
    });
  });

  return routes;
}
