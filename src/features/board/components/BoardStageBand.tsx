import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, CircleCheckBig } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Collapsible } from "../../../components/ui/Collapsible";
import { STAGE_LABELS, type BoardStage } from "../layout/boardStructure";

type BoardStageBandProps = {
  stage: BoardStage;
  /** How many cards are in this band, folded or not. */
  total: number;
  /** How many of them are still to do. */
  remaining: number;
  open: boolean;
  /** Absent on a board that cannot be folded, which draws every band open. */
  onToggle?: () => void;
  children: ReactNode;
};

/**
 * One stage of the board, as a band that folds.
 *
 * This replaces the focus view, and the difference is the whole point. Focus was a *mode*: it took
 * twenty-eight cards off the screen and left a number behind, so a hire looking at six cards had to
 * trust that the rest were somewhere. A band is a *fold*: everything the board holds is on the page,
 * named, counted, and one click from being read. The same six cards are in front of them and the
 * other twenty-eight are visibly filed under "Later" rather than gone.
 *
 * That is also the shape the customer asked for. A notebook does not hide the sections you are not
 * reading; it puts them in order and lets you open one. The section bar above does that for areas —
 * *where* a card belongs — and this does it for stages: *when* it is due. Two axes, each with the
 * control it needs, and neither of them a mode.
 *
 * The header is a real button rather than a `<details>` element, because the fold state belongs to
 * the board — it is set by "Show everything" and by the board's own size on arrival — and a
 * `<details>` that the page also controls is two owners of one piece of state.
 */
export function BoardStageBand({
  stage,
  total,
  remaining,
  open,
  onToggle,
  children,
}: BoardStageBandProps) {
  const label = STAGE_LABELS[stage];
  const done = remaining === 0;

  const heading = (
    <>
      <span className="text-sm font-semibold text-app-text">{label.title}</span>

      {/* The hint earns its place on the open band only. Folded, the line is a summary and the
          count is the part somebody is deciding on; three sentences of guidance stacked above a
          board is the reading this page is trying to reduce. */}
      {open && <span className="hidden text-xs text-app-text-muted sm:inline">{label.hint}</span>}

      {done ? (
        <Badge variant="purple" size="sm" className="gap-1">
          <CircleCheckBig className="h-3 w-3" aria-hidden="true" />
          All done
        </Badge>
      ) : (
        <Badge variant={stage === "NOW" ? "brand" : "neutral"} size="sm">
          <span className="tabular-nums">{remaining} to do</span>
        </Badge>
      )}

      {/* Only when it differs from what is left: "12 cards · 12 to do" is the same fact twice. */}
      {!done && total !== remaining && (
        <span className="text-xs text-app-text-muted tabular-nums">{total} in all</span>
      )}
    </>
  );

  return (
    <section className="space-y-3">
      {onToggle ? (
        <button
          type="button"
          // `detail > 1` is the second click of a double click. Without this a band answered a
          // double click by folding and unfolding again, which looks like the board ignoring the
          // gesture — and a double click on something folded is exactly what people try first.
          onClick={(event) => {
            if (event.detail > 1) return;
            onToggle();
          }}
          aria-expanded={open}
          className="flex w-full flex-wrap items-center gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-app-surface-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden="true" />
          )}
          {heading}
        </button>
      ) : (
        <p className="flex w-full flex-wrap items-center gap-2 px-1 py-1">{heading}</p>
      )}

      <Collapsible open={open}>{children}</Collapsible>
    </section>
  );
}
