import { memo } from "react";
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import { CheckSquare, Lock, Pencil, Trash2, Users } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import type { CardBlueprint } from "../types";
import { NODE_HEIGHT, NODE_WIDTH } from "./canvasLayout";

export type BlueprintNodeData = {
  blueprint: CardBlueprint;
  /** The names of the roles this card is aimed at. Empty means everybody on the project. */
  roleNames: string[];
  /**
   * What this card waits on, named only when that card is not drawn beside it — filtered out by the
   * role selector, or sitting in the other band. An edge already says it when both ends are here.
   */
  waitsOnTitle: string | null;
  onEdit: (blueprint: CardBlueprint) => void;
  onRemove: (blueprint: CardBlueprint) => void;
};

export type BlueprintFlowNode = Node<BlueprintNodeData, "blueprint">;

/**
 * One card blueprint as a box on the canvas.
 *
 * Shows what the hire will see — the title, the first lines of the checklist — rather than what the
 * PM typed into which field, because the question being asked of this canvas is always "what does a
 * new hire get", and a box that listed its own form fields would answer a question nobody has.
 *
 * **The handles are the point of the box.** Dragging from the right edge to another card's left edge
 * is the "comes after" dependency, which until now lived in a dropdown that could only be reached by
 * opening one card at a time — so the chain a PM was building was never visible while they built it.
 *
 * The actions sit in a toolbar that appears above a selected card rather than inside the box: at
 * 264px there is no corner to put two buttons in that does not cost the title its room, and a
 * canvas of forty cards each showing its own delete button is a canvas of eighty buttons.
 */
function BlueprintNodeComponent({ data, selected }: NodeProps<BlueprintFlowNode>) {
  const { blueprint, roleNames, waitsOnTitle, onEdit, onRemove } = data;

  // A card that has to explain what it is waiting on gives up a checklist line for the sentence.
  const shownItems = blueprint.items.slice(0, waitsOnTitle ? 2 : 3);
  const remaining = blueprint.items.length - shownItems.length;

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} className="nodrag nopan">
        <div className="flex items-center gap-1 rounded-xl border border-app-border bg-app-surface p-1 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => onEdit(blueprint)}
            aria-label={`Edit "${blueprint.title}"`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            iconOnly
            onClick={() => onRemove(blueprint)}
            aria-label={`Remove "${blueprint.title}"`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </NodeToolbar>

      <div
        data-testid={`blueprint-node-${blueprint.id}`}
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
        className={[
          "flex flex-col gap-1.5 overflow-hidden rounded-2xl border bg-app-surface px-3 py-2.5 transition-shadow duration-200",
          selected
            ? "border-app-brand ring-2 ring-app-focus"
            : "border-app-border hover:shadow-app-brand-lift",
        ].join(" ")}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-app-surface !bg-app-brand"
        />

        <p className="flex items-center gap-1.5 text-sm font-semibold text-app-text">
          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-app-text-subtle" aria-hidden="true" />
          <span className="min-w-0 truncate" title={blueprint.title}>
            {blueprint.title}
          </span>
        </p>

        {blueprint.description && (
          <p className="truncate text-xs text-app-text-muted" title={blueprint.description}>
            {blueprint.description}
          </p>
        )}

        {shownItems.length > 0 && (
          <ul className="min-h-0 space-y-0.5">
            {shownItems.map((item, index) => (
              <li key={`${item}-${index}`} className="truncate text-xs text-app-text-muted">
                · {item}
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-xs text-app-text-subtle">+{remaining} more lines</li>
            )}
          </ul>
        )}

        <div className="mt-auto space-y-0.5">
          {waitsOnTitle && (
            <p className="flex items-center gap-1 text-xs text-app-text-muted">
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">waits for {waitsOnTitle}</span>
            </p>
          )}
          <p className="flex items-center gap-1 text-xs text-app-text-subtle">
            <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">
              {roleNames.length === 0 ? "Everybody" : roleNames.join(", ")}
            </span>
          </p>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-app-surface !bg-app-brand"
        />
      </div>
    </>
  );
}

export const BlueprintNode = memo(BlueprintNodeComponent);
