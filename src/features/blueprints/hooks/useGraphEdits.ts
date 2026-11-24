import { useCallback, useState } from "react";
import { EDGE_REFUSAL_MESSAGE, type GraphPoint, edgeRefusal } from "../graphKit.ts";
import type { BlueprintGraphCanvasNode, Props } from "../components/blueprintGraphCanvasTypes.ts";

/**
 * Runs graph mutations one at a time, holding the canvas still while one is in flight and surfacing
 * the reason when it fails. A failure with no message of its own says what was being attempted.
 */
export function useGraphSaving() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  return { isSaving, saveError, setSaveError, runMutation };
}

type EditParams<TNode extends BlueprintGraphCanvasNode> = {
  nodes: TNode[];
  nodeById: Map<string, TNode>;
  runMutation: ReturnType<typeof useGraphSaving>["runMutation"];
  setSaveError: (message: string | null) => void;
  /** Dragging while an arrangement is being reviewed edits that arrangement rather than saving. */
  preview: Record<string, GraphPoint> | null;
  setPreview: (preview: Record<string, GraphPoint>) => void;
  setOverrides: (
    update: (current: Record<string, GraphPoint>) => Record<string, GraphPoint>,
  ) => void;
} & Pick<Props<TNode>, "onPositionChange" | "onAddBlocker" | "onRemoveBlocker" | "onCreateNode">;

/**
 * Saves a dragged node where it was dropped. While a tidy-up proposal is being reviewed a drag edits
 * the proposal instead: saving one card out of a layout the author has not accepted would leave the
 * graph half in each.
 */
function useNodeMove<TNode extends BlueprintGraphCanvasNode>(params: EditParams<TNode>) {
  const { nodeById, runMutation, preview, setPreview, setOverrides, onPositionChange } = params;

  return useCallback(
    (id: string, point: GraphPoint) => {
      const node = nodeById.get(id);
      if (!node) return;
      const centre = { x: Math.round(point.x), y: Math.round(point.y) };

      if (preview) {
        setPreview({ ...preview, [id]: centre });
        return;
      }

      setOverrides((current) => ({ ...current, [id]: centre }));
      void runMutation(async () => {
        try {
          await onPositionChange(node, centre.x, centre.y);
        } catch (reason) {
          // Back to where the server still has it, rather than showing a move that did not happen.
          setOverrides((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
          throw reason;
        }
      }, "The node position could not be saved.");
    },
    [nodeById, onPositionChange, preview, runMutation, setOverrides, setPreview],
  );
}

/** What the author does to the graph: move a node, connect two, take a connection away, make one. */
export function useGraphEdits<TNode extends BlueprintGraphCanvasNode>(params: EditParams<TNode>) {
  const { nodes, nodeById, runMutation, setSaveError } = params;
  const { onAddBlocker, onRemoveBlocker, onCreateNode } = params;

  const handleMove = useNodeMove(params);

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
    [nodeById, nodes, onAddBlocker, runMutation, setSaveError],
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

  return { handleMove, handleConnect, handleDisconnect, createAt };
}
