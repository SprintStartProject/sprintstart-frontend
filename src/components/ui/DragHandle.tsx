import { GripVertical } from "lucide-react";

export type DragHandleProps = {
  /**
   * Literal Tailwind utility classes that control the visible/hover state,
   * e.g. `"group-hover/task-item:mr-1 group-hover/task-item:w-4 group-hover/task-item:opacity-100"`.
   * Must reference the `group/<name>` class of an ancestor element, since Tailwind
   * needs the full class strings to appear literally in source for its scanner to
   * generate them - they can't be composed dynamically at runtime.
   */
  visibleClassName: string;
  className?: string;
};

/**
 * Drag handle icon that takes up no space by default (width 0, hidden) and
 * expands into view on hover of an ancestor `group/<name>` element, nudging
 * sibling content aside instead of reserving empty space up front. Used for
 * step/task reordering affordances across team-management detail views.
 */
export function DragHandle({ visibleClassName, className = "" }: DragHandleProps) {
  return (
    <span
      className={`flex w-0 shrink-0 cursor-grab items-center justify-center overflow-hidden text-app-text-disabled opacity-0 transition-all active:cursor-grabbing ${visibleClassName} ${className}`.trim()}
      aria-hidden="true"
    >
      <GripVertical className="h-4 w-4 shrink-0" />
    </span>
  );
}
