import { useCallback, useMemo, useState } from "react";
import { blockersBehind, dependentsAhead } from "../../graph-diagram/graphLayout.ts";
import type { BlueprintGraphCanvasNode } from "../components/blueprintGraphCanvasTypes.ts";

/**
 * Which half of the lit run something is in: what has to happen before the node being pointed at,
 * or what that node opens up.
 *
 * The two are the whole question somebody asks by pointing at a node, and an arrowhead answers it
 * only if you follow the arrow. Two colours answer it at a glance, which is what a graph is for --
 * so the halves are drawn apart rather than lit as one undifferentiated blob.
 */
export type ChainHalf = "focus" | "behind" | "ahead";

/**
 * The node being pointed at or picked, and the run it is tangled up in.
 *
 * Hover wins over selection: the pointer is the more recent statement of interest, and a selection
 * that refused to give way while somebody swept the graph would be the graph arguing. Selection
 * stays for the node somebody is working on; hover is for the far more common act of sweeping across
 * a graph asking "what is this one tangled up with". Making that cost a click meant that on a
 * sixteen-phase graph nobody ever asked.
 */
export function useChainFocus(
  nodes: BlueprintGraphCanvasNode[],
  nodeById: Map<string, BlueprintGraphCanvasNode>,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
   * unrelated is not one of the reasons the focus is shut, and colouring it as though it were would
   * make the run look bigger than it is.
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

  return {
    selectedId,
    setSelectedId,
    setHoveredId,
    focusId,
    focus,
    chainIds,
    halfOfNode,
    halfOfEdge,
  };
}
