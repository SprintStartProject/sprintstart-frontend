import { useCallback } from "react";
import type { GraphPoint } from "../graphKit.ts";
import type { BlueprintGraphCanvasNode, Props } from "../components/blueprintGraphCanvasTypes.ts";
import type { useGraphPositions } from "./useGraphPositions";
import type { useGraphSaving } from "./useGraphEdits";

type Params<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  positions: Pick<
    ReturnType<typeof useGraphPositions>,
    "preview" | "setPreview" | "setArrangement" | "layeredFor"
  >;
  runMutation: ReturnType<typeof useGraphSaving>["runMutation"];
} & Pick<Props<TNode>, "onPositionChange">;

/** The positions a proposal would write, where they differ from what is stored. */
function changedPositions<TNode extends BlueprintGraphCanvasNode>(
  nodes: TNode[],
  proposal: Record<string, GraphPoint>,
) {
  const changes: { node: TNode; x: number; y: number }[] = [];
  for (const node of nodes) {
    const target = proposal[node.id];
    if (!target) continue;
    const x = Math.round(target.x);
    const y = Math.round(target.y);
    if (node.graphX !== x || node.graphY !== y) changes.push({ node, x, y });
  }
  return changes;
}

/**
 * "Tidy up": lay every node out again by prerequisite, show the result, and only save it when the
 * author says to. The only thing in this editor with no way back, so it asks.
 */
export function useTidyUp<TNode extends BlueprintGraphCanvasNode>(params: Params<TNode>) {
  const { nodes, positions, runMutation, onPositionChange } = params;
  const { preview, setPreview, setArrangement, layeredFor } = positions;

  /** Lays every node out again and shows the result, without saving any of it. */
  const handleTidyUp = useCallback(() => {
    setPreview(layeredFor(nodes));
    setArrangement((count) => count + 1);
  }, [layeredFor, nodes, setArrangement, setPreview]);

  /** Writes the proposed arrangement back, one card at a time, and only where it differs. */
  const handleAcceptPreview = useCallback(() => {
    if (!preview) return;
    const changes = changedPositions(nodes, preview);

    void runMutation(async () => {
      // Every card is tried, so one refusal does not leave the rest of the layout unsaved; the
      // preview stays open when anything failed, to accept again.
      let failed = 0;
      for (const { node, x, y } of changes) {
        try {
          await onPositionChange(node, x, y);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        throw new Error(
          `${failed} of ${changes.length} cards could not be moved. Accept again to retry them.`,
        );
      }
      setPreview(null);
    }, "The layout could not be saved.");
  }, [nodes, onPositionChange, preview, runMutation, setPreview]);

  const handleDiscardPreview = useCallback(() => {
    setPreview(null);
    setArrangement((count) => count + 1);
  }, [setArrangement, setPreview]);

  return { handleTidyUp, handleAcceptPreview, handleDiscardPreview };
}
