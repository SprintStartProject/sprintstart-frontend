import type { DragEvent } from "react";
import { GripVertical, Plus, Users } from "lucide-react";

import type { ProjectRole } from "../../team-management/types";

/** What a palette tile carries onto the canvas. */
export type PaletteDrag = { roleIds: string[] };

/**
 * The drag payload's own MIME type.
 *
 * Its own rather than `text/plain` so a drop from anywhere else — a file, a selection, a link — is
 * ignored instead of quietly creating an untitled card. `text/plain` is set alongside it because
 * some browsers will not start a drag at all without it.
 */
export const PALETTE_MIME = "application/x-sprintstart-card-blueprint";

type BlueprintPaletteProps = {
  /** The project's roles. Each gets a tile that creates a card already aimed at it. */
  roles: ProjectRole[];
  className?: string;
};

function tileDragHandlers(payload: PaletteDrag) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
      event.dataTransfer.setData("text/plain", "card blueprint");
      event.dataTransfer.effectAllowed = "copy";
    },
  };
}

/**
 * The things a PM can drag onto the canvas.
 *
 * Deliberately short. A palette earns its width when it is a catalogue of things that behave
 * differently — there is exactly one kind of card blueprint here, so a row of invented "types"
 * would be a taxonomy the model does not have and the PM would have to learn for nothing.
 *
 * What it does carry is the one distinction that *is* in the model and is otherwise three clicks
 * deep: who the card is for. Dragging a role's tile creates a card already aimed at that role,
 * which is the difference between writing a backend hire's board and writing everybody's.
 *
 * Dragging is not the only way in — the page's "New blueprint" button writes the same card from the
 * keyboard. A canvas whose only door is a pointer would be a canvas some people cannot author on.
 */
export function BlueprintPalette({ roles, className }: BlueprintPaletteProps) {
  return (
    <aside
      className={[
        "flex w-56 shrink-0 flex-col gap-2 border-r border-app-border bg-app-surface-muted/40 p-3",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Card palette"
    >
      <div className="space-y-0.5 px-1">
        <h3 className="text-xs font-semibold text-app-text">Drag onto the canvas</h3>
        <p className="text-xs text-app-text-muted">
          The band you drop it in decides when it is due.
        </p>
      </div>

      <div
        {...tileDragHandlers({ roleIds: [] })}
        data-testid="palette-card"
        className="flex cursor-grab items-center gap-2 rounded-xl border border-app-border bg-app-surface px-2.5 py-2 text-sm text-app-text transition-shadow hover:shadow-app-brand-lift active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-app-text-subtle" aria-hidden="true" />
        <Plus className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
        <span className="min-w-0 truncate">Card for everybody</span>
      </div>

      {roles.length > 0 && (
        <>
          <p className="px-1 pt-1 text-xs font-medium text-app-text-muted">Aimed at a role</p>
          <ul className="space-y-1.5">
            {roles.map((role) => (
              <li key={role.id}>
                <div
                  {...tileDragHandlers({ roleIds: [role.id] })}
                  data-testid={`palette-role-${role.id}`}
                  className="flex cursor-grab items-center gap-2 rounded-xl border border-app-border bg-app-surface px-2.5 py-2 text-sm text-app-text transition-shadow hover:shadow-app-brand-lift active:cursor-grabbing"
                >
                  <GripVertical
                    className="h-3.5 w-3.5 shrink-0 text-app-text-subtle"
                    aria-hidden="true"
                  />
                  <Users className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
                  <span className="min-w-0 truncate" title={role.name}>
                    {role.name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
