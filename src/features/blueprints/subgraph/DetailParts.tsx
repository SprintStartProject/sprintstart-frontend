import { Minus, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button.tsx";

/** A titled list in a node's details, with an optional action beside the title. */
export function DetailList({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-app-text">{title}</h3>
        {action}
      </div>
      <ul className="mt-2 space-y-2">{children}</ul>
    </section>
  );
}

export function EmptyDetailListItem({ children }: { children: ReactNode }) {
  return <li className="text-app-text-muted">{children}</li>;
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-app-surface-muted p-3">
      <dt className="text-xs text-app-text-muted">{label}</dt>
      <dd className="mt-1 font-medium whitespace-pre-wrap text-app-text">{value}</dd>
    </div>
  );
}

/** What went wrong with a save, announced where the fields are. */
export function SaveError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-app-danger-text">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

const ROW_CLASS = {
  task: "flex cursor-pointer justify-between gap-2 rounded-lg bg-app-surface-muted p-3",
  resource:
    "flex cursor-pointer items-start justify-between gap-3 rounded-lg bg-app-surface-muted p-3",
} as const;

type ListedItem = { id: string; title: string; description: string };

/**
 * A task or resource in a step's details: the row opens it, and the minus beside it deletes it.
 * The row sits inside the list item, not instead of it: a `ul` whose children are `role="button"`
 * is announced as an empty list.
 */
export function ItemRow({
  item,
  kind,
  editable,
  onEdit,
  onRemove,
}: {
  item: ListedItem;
  kind: "task" | "resource";
  editable: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li>
      <div
        className={ROW_CLASS[kind]}
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onEdit();
          }
        }}
      >
        <div>
          <p className="font-medium text-app-text">{item.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-app-text-muted">{item.description}</p>
        </div>
        {editable ? (
          <Button
            aria-label={`Delete ${kind} ${item.title}`}
            iconOnly
            size="sm"
            variant="dangerGhost"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
